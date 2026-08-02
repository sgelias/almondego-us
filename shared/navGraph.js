// Movement primitives for anything that needs to walk the map without a
// physics body - specifically the server-side bots, which have no client to
// run collision for them.
//
// This is safe precisely because of the corridor rework (STATE.md L-012):
// corridor centerlines are provably clear of every room they don't connect
// (asserted in corridorRouting.test.js), and rooms are open boxes. So a path
// of "room center -> corridor waypoints -> room center" never intersects a
// wall, and bots need no collision detection at all.

import { deckAtY, deckFloorY, deckOfRoom } from './decks.js'
import { SKELD_STAIRS, stairBetween, stairPointAt } from './skeldStairs.js'

function roomBounds(room) {
  const [cx, , cz] = room.center
  const [w, , d] = room.size
  return { xMin: cx - w / 2, xMax: cx + w / 2, zMin: cz - d / 2, zMax: cz + d / 2 }
}

function pairKey(a, b) {
  return [a, b].sort().join('->')
}

// Half of skeldCorridors' CORRIDOR_WIDTH. Used to decide whether a point
// counts as "standing in this corridor".
const CORRIDOR_HALF_WIDTH = 2

// How finely a stair run is sampled into waypoints. The ramp is straight, so
// this only has to be dense enough that the walk reads as a climb rather
// than a jump.
const STAIR_SAMPLES = 6

export function createNavGraph(roomLayout, corridors) {
  const roomsById = new Map(roomLayout.map((room) => [room.id, room]))
  const boundsById = new Map(roomLayout.map((room) => [room.id, roomBounds(room)]))
  const adjacency = new Map(roomLayout.map((room) => [room.id, [...room.connections]]))
  const deckByRoomId = new Map(roomLayout.map((room) => [room.id, deckOfRoom(room)]))

  // Stairs are the only cross-deck edges. Adding them to the same adjacency
  // the room BFS already walks means route-finding needs no concept of
  // "changing floor" - it just finds a path, and some of the hops happen to
  // go up.
  for (const stair of SKELD_STAIRS) {
    if (!adjacency.has(stair.lower) || !adjacency.has(stair.upper)) continue
    adjacency.get(stair.lower).push(stair.upper)
    adjacency.get(stair.upper).push(stair.lower)
  }
  const corridorsByPair = new Map(corridors.map((c) => [pairKey(c.roomAId, c.roomBId), c]))

  // Position is [x, y, z] throughout. It used to be (x, z), and the rename
  // to an array argument is deliberate: a 2D call site that was missed now
  // fails loudly instead of quietly reading z as y and answering for the
  // wrong deck.
  function roomIdAt(position) {
    const [x, y, z] = position
    const deck = deckAtY(y)
    for (const [id, b] of boundsById) {
      if (deckByRoomId.get(id) !== deck) continue
      if (x >= b.xMin && x <= b.xMax && z >= b.zMin && z <= b.zMax) return id
    }
    return null
  }

  function nearestRoomId(position) {
    const [x, y, z] = position
    const deck = deckAtY(y)
    let bestId = null
    let bestDistance = Infinity
    for (const room of roomLayout) {
      if (deckOfRoom(room) !== deck) continue
      const distance = Math.hypot(room.center[0] - x, room.center[2] - z)
      if (distance < bestDistance) {
        bestDistance = distance
        bestId = room.id
      }
    }
    return bestId
  }

  function findRoomPath(fromRoomId, toRoomId) {
    if (!roomsById.has(fromRoomId) || !roomsById.has(toRoomId)) return null
    if (fromRoomId === toRoomId) return [fromRoomId]

    const previous = new Map([[fromRoomId, null]])
    const queue = [fromRoomId]
    let head = 0

    while (head < queue.length) {
      const current = queue[head]
      head += 1
      if (current === toRoomId) break
      for (const next of adjacency.get(current) ?? []) {
        if (previous.has(next)) continue
        previous.set(next, current)
        queue.push(next)
      }
    }

    if (!previous.has(toRoomId)) return null
    const path = []
    let cursor = toRoomId
    while (cursor !== null) {
      path.unshift(cursor)
      cursor = previous.get(cursor)
    }
    return path
  }

  // Corridor points are stored oriented roomA -> roomB; walking the other
  // direction needs them reversed.
  function corridorPointsFrom(fromRoomId, toRoomId) {
    const corridor = corridorsByPair.get(pairKey(fromRoomId, toRoomId))
    if (!corridor) return null
    return corridor.roomAId === fromRoomId ? corridor.points : [...corridor.points].reverse()
  }

  function closestPointOnSegment(x, z, [ax, az], [bx, bz]) {
    const dx = bx - ax
    const dz = bz - az
    const lengthSq = dx * dx + dz * dz
    if (lengthSq < 1e-9) return { point: [ax, az], t: 0, distance: Math.hypot(x - ax, z - az) }
    let t = ((x - ax) * dx + (z - az) * dz) / lengthSq
    t = Math.max(0, Math.min(1, t))
    const point = [ax + dx * t, az + dz * t]
    return { point, t, distance: Math.hypot(x - point[0], z - point[1]) }
  }

  // When something is standing in a corridor rather than a room, it cannot
  // simply head for a room's centre - that is a straight line through
  // whatever walls lie between, which is exactly how bots ended up walking
  // through walls. Instead it has to travel along the corridor it is
  // actually in until it reaches one of the two rooms that corridor joins.
  // Returns the exit walk plus which room it lands in, or null if the point
  // isn't on any corridor.
  function corridorExitWalk(x, y, z) {
    const deck = deckAtY(y)
    let best = null
    for (const corridor of corridors) {
      // A corridor two floors up is not an exit route from down here, however
      // close it looks from directly below.
      if ((corridor.deck ?? 0) !== deck) continue
      for (let i = 0; i < corridor.points.length - 1; i += 1) {
        const hit = closestPointOnSegment(x, z, corridor.points[i], corridor.points[i + 1])
        if (!best || hit.distance < best.distance) {
          best = { corridor, index: i, ...hit }
        }
      }
    }
    if (!best || best.distance > CORRIDOR_HALF_WIDTH + 1) return null

    const points = best.corridor.points
    // Walking backwards to points[0] reaches roomA; forwards to the last
    // point reaches roomB. Take whichever is nearer.
    let backwardDistance = Math.hypot(best.point[0] - points[best.index][0], best.point[1] - points[best.index][1])
    for (let i = best.index; i > 0; i -= 1) {
      backwardDistance += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1])
    }
    let forwardDistance = Math.hypot(best.point[0] - points[best.index + 1][0], best.point[1] - points[best.index + 1][1])
    for (let i = best.index + 1; i < points.length - 1; i += 1) {
      forwardDistance += Math.hypot(points[i][0] - points[i + 1][0], points[i][1] - points[i + 1][1])
    }

    const walk = [best.point]
    let roomId
    if (backwardDistance <= forwardDistance) {
      for (let i = best.index; i >= 0; i -= 1) walk.push(points[i])
      roomId = best.corridor.roomAId
    } else {
      for (let i = best.index + 1; i < points.length; i += 1) walk.push(points[i])
      roomId = best.corridor.roomBId
    }
    return { walk, roomId }
  }

  // Returns an [x, y, z] polyline from `fromPosition` to the destination.
  // Every segment that crosses a wall or runs down a corridor is
  // axis-aligned; only the first leg (current position -> starting room's
  // center) and the last (destination room's center -> in-room offset) can
  // be diagonal, and both of those stay inside a single open room where
  // there is nothing to collide with.
  //
  // A hop between decks emits points along the ramp instead of a corridor,
  // from the same stairPointAt() the geometry is built from - so a bot walks
  // the surface a player is standing on rather than a straight line through
  // it.
  function waypointsTo(fromPosition, toRoomId, toOffset) {
    const [fromX, fromY, fromZ] = fromPosition

    const points = [[fromX, fromY, fromZ]]
    const pushPoint = ([x, y, z]) => {
      const last = points[points.length - 1]
      if (last[0] !== x || last[1] !== y || last[2] !== z) points.push([x, y, z])
    }

    let fromRoomId = roomIdAt(fromPosition)
    if (!fromRoomId) {
      const deckY = deckFloorY(deckAtY(fromY))
      // In a corridor: walk it out to a real room before doing anything else.
      const exit = corridorExitWalk(fromX, fromY, fromZ)
      if (exit) {
        for (const [x, z] of exit.walk) pushPoint([x, deckY, z])
        fromRoomId = exit.roomId
      } else {
        fromRoomId = nearestRoomId(fromPosition)
      }
    }
    if (!fromRoomId) return null

    const roomPath = findRoomPath(fromRoomId, toRoomId)
    if (!roomPath) return null

    const startRoom = roomsById.get(fromRoomId)
    pushPoint([startRoom.center[0], deckFloorY(deckOfRoom(startRoom)), startRoom.center[2]])

    for (let i = 0; i < roomPath.length - 1; i += 1) {
      const nextRoom = roomsById.get(roomPath[i + 1])
      const stairLink = stairBetween(roomPath[i], roomPath[i + 1])

      if (stairLink) {
        const { stair, up } = stairLink
        // Enough samples that the polyline hugs the slope; a bot that moved
        // straight from foot to top would pass through the ramp.
        for (let step = 0; step <= STAIR_SAMPLES; step += 1) {
          const t = step / STAIR_SAMPLES
          pushPoint(stairPointAt(stair, up ? t : 1 - t))
        }
      } else {
        const corridorPoints = corridorPointsFrom(roomPath[i], roomPath[i + 1])
        if (!corridorPoints) return null
        const corridorY = deckFloorY(deckOfRoom(nextRoom))
        for (const [x, z] of corridorPoints) pushPoint([x, corridorY, z])
      }

      pushPoint([nextRoom.center[0], deckFloorY(deckOfRoom(nextRoom)), nextRoom.center[2]])
    }

    if (toOffset) {
      const destination = roomsById.get(toRoomId)
      pushPoint([
        destination.center[0] + toOffset[0],
        deckFloorY(deckOfRoom(destination)),
        destination.center[2] + toOffset[2],
      ])
    }

    return points
  }

  function randomAdjacentRoom(roomId, randomFn) {
    const neighbours = adjacency.get(roomId)
    if (!neighbours || neighbours.length === 0) return null
    return neighbours[Math.floor(randomFn() * neighbours.length)]
  }

  function roomCenter(roomId) {
    const room = roomsById.get(roomId)
    return room ? [room.center[0], deckFloorY(deckOfRoom(room)), room.center[2]] : null
  }

  function deckOfRoomId(roomId) {
    return deckByRoomId.get(roomId) ?? null
  }

  // Line of sight, not raw proximity. Rooms on this map sit close enough
  // together that a distance-only test sees straight through walls.
  //
  // This lives here, in shared code, because both the bots' sensing and the
  // client's "which players do I actually render" use it. Two copies would
  // drift, and the drift would be exactly the unfairness the limited-vision
  // feature exists to remove - a bot and a human standing in the same spot
  // must see the same set of people.
  function canSee(fromPosition, toPosition, radius) {
    const [fromX, fromY, fromZ] = fromPosition
    const [toX, toY, toZ] = toPosition
    // A floor is opaque. This has to come first: two players on the same
    // (x, z) one deck apart are zero units away horizontally, so every other
    // rule here would happily call them visible.
    if (deckAtY(fromY) !== deckAtY(toY)) return false
    if (Math.hypot(fromX - toX, fromZ - toZ) > radius) return false
    const fromRoom = roomIdAt(fromPosition)
    const toRoom = roomIdAt(toPosition)
    // Both inside rooms: only the same room counts as visible.
    if (fromRoom && toRoom) return fromRoom === toRoom
    // At least one is in a corridor, where the sightline runs along its
    // length and is short anyway - distance alone is a fair approximation.
    return true
  }

  return {
    roomIdAt,
    nearestRoomId,
    findRoomPath,
    waypointsTo,
    randomAdjacentRoom,
    roomCenter,
    canSee,
    deckOfRoomId,
  }
}
