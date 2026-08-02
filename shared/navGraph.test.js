import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createNavGraph } from './navGraph.js'
import { ROOM_LAYOUT } from './skeldRooms.js'
import { SKELD_CORRIDORS } from './skeldCorridors.js'
import { TASK_LOCATIONS } from './taskPool.js'

const nav = createNavGraph(ROOM_LAYOUT, SKELD_CORRIDORS)

test('findRoomPath connects every ordered pair of the 14 rooms', () => {
  for (const from of ROOM_LAYOUT) {
    for (const to of ROOM_LAYOUT) {
      const path = nav.findRoomPath(from.id, to.id)
      assert.ok(path, `no path from ${from.id} to ${to.id}`)
      assert.equal(path[0], from.id)
      assert.equal(path[path.length - 1], to.id)
    }
  }
})

test('findRoomPath returns a single-entry path for a room to itself', () => {
  assert.deepEqual(nav.findRoomPath('cafeteria', 'cafeteria'), ['cafeteria'])
})

test('findRoomPath returns null for an unknown room id', () => {
  assert.equal(nav.findRoomPath('cafeteria', 'nowhere'), null)
})

test('every consecutive pair in a room path is actually connected', () => {
  const path = nav.findRoomPath('security', 'navigation')
  for (let i = 0; i < path.length - 1; i += 1) {
    const room = ROOM_LAYOUT.find((r) => r.id === path[i])
    assert.ok(room.connections.includes(path[i + 1]), `${path[i]} is not connected to ${path[i + 1]}`)
  }
})

test('roomIdAt identifies a room interior and returns null in a corridor', () => {
  const cafeteria = ROOM_LAYOUT.find((r) => r.id === 'cafeteria')
  assert.equal(nav.roomIdAt(cafeteria.center[0], cafeteria.center[2]), 'cafeteria')
  // Far outside every room footprint (the map's rooms all sit within |x|,|z| <= 40).
  assert.equal(nav.roomIdAt(200, 200), null)
})

test('waypointsTo starts at the given position and ends at the destination offset', () => {
  const start = [-11, 33] // cafeteria center
  const points = nav.waypointsTo(start, 'electrical', [1, 0, 2])
  assert.ok(points)
  assert.deepEqual(points[0], start)

  const electrical = ROOM_LAYOUT.find((r) => r.id === 'electrical')
  assert.deepEqual(points[points.length - 1], [electrical.center[0] + 1, electrical.center[2] + 2])
})

test('every wall-crossing segment of a waypoint path is axis-aligned', () => {
  // The first leg (position -> starting room center) and the last (destination
  // center -> in-room offset) may be diagonal, but both stay inside one open
  // room. Everything between them crosses walls/corridors and must be
  // axis-aligned or a bot would clip geometry.
  for (const [from, to] of [
    ['cafeteria', 'reactor'],
    ['medbay', 'communications'],
    ['security', 'navigation'],
    ['o2', 'lowerEngine'],
  ]) {
    const start = nav.roomCenter(from)
    const points = nav.waypointsTo(start, to, null)
    assert.ok(points, `no waypoints from ${from} to ${to}`)
    for (let i = 1; i < points.length - 1; i += 1) {
      const [x1, z1] = points[i]
      const [x2, z2] = points[i + 1]
      assert.ok(x1 === x2 || z1 === z2, `${from}->${to} segment ${i} is diagonal: ${points[i]} -> ${points[i + 1]}`)
    }
  }
})

test('waypointsTo produces no zero-length duplicate points', () => {
  const points = nav.waypointsTo(nav.roomCenter('cafeteria'), 'shields', null)
  for (let i = 0; i < points.length - 1; i += 1) {
    assert.notDeepEqual(points[i], points[i + 1], `duplicate waypoint at index ${i}`)
  }
})

// A point is legal for a walking bot if it is inside a room, or within half
// the corridor width of some corridor centreline. Anything else is inside a
// wall or out in the void.
function isWalkable(x, z) {
  if (nav.roomIdAt(x, z)) return true
  const HALF = 2
  for (const corridor of SKELD_CORRIDORS) {
    for (let i = 0; i < corridor.points.length - 1; i += 1) {
      const [ax, az] = corridor.points[i]
      const [bx, bz] = corridor.points[i + 1]
      const dx = bx - ax
      const dz = bz - az
      const lengthSq = dx * dx + dz * dz
      let t = lengthSq < 1e-9 ? 0 : ((x - ax) * dx + (z - az) * dz) / lengthSq
      t = Math.max(0, Math.min(1, t))
      if (Math.hypot(x - (ax + dx * t), z - (az + dz * t)) <= HALF + 0.01) return true
    }
  }
  return false
}

function assertPathWalkable(points, label) {
  for (let i = 0; i < points.length - 1; i += 1) {
    const [x1, z1] = points[i]
    const [x2, z2] = points[i + 1]
    const steps = Math.max(2, Math.ceil(Math.hypot(x2 - x1, z2 - z1) * 4))
    for (let s = 0; s <= steps; s += 1) {
      const t = s / steps
      const x = x1 + (x2 - x1) * t
      const z = z1 + (z2 - z1) * t
      assert.ok(isWalkable(x, z), `${label}: path leaves walkable space at ${x.toFixed(2)},${z.toFixed(2)}`)
    }
  }
}

test('a path starting inside a room never leaves walkable space', () => {
  for (const from of ROOM_LAYOUT) {
    for (const to of ROOM_LAYOUT) {
      const points = nav.waypointsTo(nav.roomCenter(from.id), to.id, null)
      assert.ok(points, `no path ${from.id} -> ${to.id}`)
      assertPathWalkable(points, `${from.id} -> ${to.id}`)
    }
  }
})

test('a path starting mid-corridor walks the corridor out instead of cutting through walls', () => {
  // This is the case that had bots visibly walking through walls: from a
  // corridor, roomIdAt returns null and the old code drew a straight line
  // to the nearest room's centre.
  for (const corridor of SKELD_CORRIDORS) {
    for (let i = 0; i < corridor.points.length - 1; i += 1) {
      const [ax, az] = corridor.points[i]
      const [bx, bz] = corridor.points[i + 1]
      for (const t of [0.25, 0.5, 0.75]) {
        const x = ax + (bx - ax) * t
        const z = az + (bz - az) * t
        for (const target of ['cafeteria', 'reactor', 'navigation']) {
          const points = nav.waypointsTo([x, z], target, null)
          assert.ok(points, `no path from corridor ${corridor.roomAId}->${corridor.roomBId} to ${target}`)
          assertPathWalkable(points, `corridor ${corridor.roomAId}->${corridor.roomBId} @${t} -> ${target}`)
        }
      }
    }
  }
})

test('a path to every task step stays walkable all the way to the console', () => {
  // Every step, not every task: a fetch task sends the player to two rooms
  // and the second leg is just as capable of being unreachable.
  for (const task of TASK_LOCATIONS) {
    for (const [index, step] of task.steps.entries()) {
      const points = nav.waypointsTo(nav.roomCenter('cafeteria'), step.roomId, step.offset)
      assert.ok(points, `no path to ${task.id} step ${index}`)
      assertPathWalkable(points, `${task.id} step ${index}`)
    }
  }
})

test('randomAdjacentRoom only ever returns a declared connection', () => {
  const alwaysFirst = () => 0
  assert.equal(nav.randomAdjacentRoom('medbay', alwaysFirst), 'cafeteria')

  const room = ROOM_LAYOUT.find((r) => r.id === 'storage')
  for (let i = 0; i < 20; i += 1) {
    const picked = nav.randomAdjacentRoom('storage', Math.random)
    assert.ok(room.connections.includes(picked), `${picked} is not connected to storage`)
  }
})
