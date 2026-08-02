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

  // Returns an [x, z] polyline from `fromPosition` to the destination.
  // Every segment that crosses a wall or runs down a corridor is
  // axis-aligned; only the first leg (current position -> starting room's
  // center) and the last (destination room's center -> in-room offset) can
  // be diagonal, and both of those stay inside a single open room where
  // there is nothing to collide with.
  function waypointsTo(fromPosition, toRoomId, toOffset) {
    const [fromX, fromZ] = fromPosition
    const fromRoomId = roomIdAt(fromX, fromZ) ?? nearestRoomId(fromX, fromZ)
    const roomPath = findRoomPath(fromRoomId, toRoomId)
    if (!roomPath) return null

    const points = [[fromX, fromZ]]
    const pushPoint = ([x, z]) => {
      const last = points[points.length - 1]
      if (last[0] !== x || last[1] !== z) points.push([x, z])
    }

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

  return { roomIdAt, nearestRoomId, findRoomPath, waypointsTo, randomAdjacentRoom, roomCenter }
}
