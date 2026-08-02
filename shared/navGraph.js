// Movement primitives for anything that needs to walk the map without a
// physics body - specifically the server-side bots, which have no client to
// run collision for them.
//
// This is safe precisely because of the corridor rework (STATE.md L-012):
// corridor centerlines are provably clear of every room they don't connect
// (asserted in corridorRouting.test.js), and rooms are open boxes. So a path
// of "room center -> corridor waypoints -> room center" never intersects a
// wall, and bots need no collision detection at all.

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

export function createNavGraph(roomLayout, corridors) {
  const roomsById = new Map(roomLayout.map((room) => [room.id, room]))
  const boundsById = new Map(roomLayout.map((room) => [room.id, roomBounds(room)]))
  const adjacency = new Map(roomLayout.map((room) => [room.id, [...room.connections]]))
  const corridorsByPair = new Map(corridors.map((c) => [pairKey(c.roomAId, c.roomBId), c]))

  function roomIdAt(x, z) {
    for (const [id, b] of boundsById) {
      if (x >= b.xMin && x <= b.xMax && z >= b.zMin && z <= b.zMax) return id
    }
    return null
  }

  function nearestRoomId(x, z) {
    let bestId = null
    let bestDistance = Infinity
    for (const room of roomLayout) {
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
  function corridorExitWalk(x, z) {
    let best = null
    for (const corridor of corridors) {
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

  // Returns an [x, z] polyline from `fromPosition` to the destination.
  // Every segment that crosses a wall or runs down a corridor is
  // axis-aligned; only the first leg (current position -> starting room's
  // center) and the last (destination room's center -> in-room offset) can
  // be diagonal, and both of those stay inside a single open room where
  // there is nothing to collide with.
  function waypointsTo(fromPosition, toRoomId, toOffset) {
    const [fromX, fromZ] = fromPosition

    const points = [[fromX, fromZ]]
    const pushPoint = ([x, z]) => {
      const last = points[points.length - 1]
      if (last[0] !== x || last[1] !== z) points.push([x, z])
    }

    let fromRoomId = roomIdAt(fromX, fromZ)
    if (!fromRoomId) {
      // In a corridor: walk it out to a real room before doing anything else.
      const exit = corridorExitWalk(fromX, fromZ)
      if (exit) {
        for (const point of exit.walk) pushPoint(point)
        fromRoomId = exit.roomId
      } else {
        fromRoomId = nearestRoomId(fromX, fromZ)
      }
    }

    const roomPath = findRoomPath(fromRoomId, toRoomId)
    if (!roomPath) return null

    const startRoom = roomsById.get(fromRoomId)
    pushPoint([startRoom.center[0], startRoom.center[2]])

    for (let i = 0; i < roomPath.length - 1; i += 1) {
      const corridorPoints = corridorPointsFrom(roomPath[i], roomPath[i + 1])
      if (!corridorPoints) return null
      for (const point of corridorPoints) pushPoint(point)
      const nextRoom = roomsById.get(roomPath[i + 1])
      pushPoint([nextRoom.center[0], nextRoom.center[2]])
    }

    if (toOffset) {
      const destination = roomsById.get(toRoomId)
      pushPoint([destination.center[0] + toOffset[0], destination.center[2] + toOffset[2]])
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
    return room ? [room.center[0], room.center[2]] : null
  }

  // Line of sight, not raw proximity. Rooms on this map sit close enough
  // together that a distance-only test sees straight through walls.
  //
  // This lives here, in shared code, because both the bots' sensing and the
  // client's "which players do I actually render" use it. Two copies would
  // drift, and the drift would be exactly the unfairness the limited-vision
  // feature exists to remove - a bot and a human standing in the same spot
  // must see the same set of people.
  function canSee(fromX, fromZ, toX, toZ, radius) {
    if (Math.hypot(fromX - toX, fromZ - toZ) > radius) return false
    const fromRoom = roomIdAt(fromX, fromZ)
    const toRoom = roomIdAt(toX, toZ)
    // Both inside rooms: only the same room counts as visible.
    if (fromRoom && toRoom) return fromRoom === toRoom
    // At least one is in a corridor, where the sightline runs along its
    // length and is short anyway - distance alone is a fair approximation.
    return true
  }

  return { roomIdAt, nearestRoomId, findRoomPath, waypointsTo, randomAdjacentRoom, roomCenter, canSee }
}
