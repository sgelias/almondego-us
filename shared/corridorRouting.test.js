import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeCorridors, corridorExitPoint } from './corridorRouting.js'
import { ROOM_LAYOUT } from './skeldRooms.js'

const CORRIDOR_WIDTH = 4

function roomBounds(room) {
  const [cx, , cz] = room.center
  const [w, , d] = room.size
  return { xMin: cx - w / 2, xMax: cx + w / 2, zMin: cz - d / 2, zMax: cz + d / 2 }
}

function onBoundary(point, room) {
  const [x, z] = point
  const b = roomBounds(room)
  const EPSILON = 1e-6
  const onVerticalWall = (Math.abs(x - b.xMin) < EPSILON || Math.abs(x - b.xMax) < EPSILON) && z >= b.zMin - EPSILON && z <= b.zMax + EPSILON
  const onHorizontalWall = (Math.abs(z - b.zMin) < EPSILON || Math.abs(z - b.zMax) < EPSILON) && x >= b.xMin - EPSILON && x <= b.xMax + EPSILON
  return onVerticalWall || onHorizontalWall
}

function segmentIntersectsRoom(x1, z1, x2, z2, room, corridorWidth) {
  const halfWidth = corridorWidth / 2
  const b = roomBounds(room)
  const EPSILON = 1e-6
  if (x1 === x2) {
    const segXMin = x1 - halfWidth
    const segXMax = x1 + halfWidth
    const segZMin = Math.min(z1, z2)
    const segZMax = Math.max(z1, z2)
    return segXMin < b.xMax - EPSILON && b.xMin < segXMax - EPSILON && segZMin < b.zMax - EPSILON && b.zMin < segZMax - EPSILON
  }
  const segZMin = z1 - halfWidth
  const segZMax = z1 + halfWidth
  const segXMin = Math.min(x1, x2)
  const segXMax = Math.max(x1, x2)
  return segXMin < b.xMax - EPSILON && b.xMin < segXMax - EPSILON && segZMin < b.zMax - EPSILON && b.zMin < segZMax - EPSILON
}

// The router is per deck (see skeldCorridors.js): rooms on another floor are
// not obstacles. Feeding it the whole ship at once would have an upper-deck
// laboratory blocking a corridor two floors below.
const LOWER_DECK_ROOMS = ROOM_LAYOUT.filter((room) => (room.deck ?? 0) === 0)

test('computeCorridors routes every lower-deck connection with no override', () => {
  const expected = LOWER_DECK_ROOMS.reduce((total, room) => total + room.connections.length, 0) / 2
  const corridors = computeCorridors(LOWER_DECK_ROOMS, CORRIDOR_WIDTH)
  assert.equal(corridors.length, expected)
})

test('every corridor waypoint pair is axis-aligned (shares an x or a z)', () => {
  const corridors = computeCorridors(LOWER_DECK_ROOMS, CORRIDOR_WIDTH)
  for (const corridor of corridors) {
    for (let i = 0; i < corridor.points.length - 1; i += 1) {
      const [x1, z1] = corridor.points[i]
      const [x2, z2] = corridor.points[i + 1]
      assert.ok(x1 === x2 || z1 === z2, `${corridor.roomAId}->${corridor.roomBId} segment ${i} is diagonal`)
    }
  }
})

test('every corridor starts and ends exactly on its room boundary', () => {
  const corridors = computeCorridors(LOWER_DECK_ROOMS, CORRIDOR_WIDTH)
  for (const corridor of corridors) {
    const roomA = LOWER_DECK_ROOMS.find((r) => r.id === corridor.roomAId)
    const roomB = LOWER_DECK_ROOMS.find((r) => r.id === corridor.roomBId)
    const first = corridor.points[0]
    const last = corridor.points[corridor.points.length - 1]
    assert.ok(onBoundary(first, roomA), `${corridor.roomAId}->${corridor.roomBId} start not on ${roomA.id}'s boundary`)
    assert.ok(onBoundary(last, roomB), `${corridor.roomAId}->${corridor.roomBId} end not on ${roomB.id}'s boundary`)
  }
})

test('no corridor segment clips a room other than its own two endpoints', () => {
  const corridors = computeCorridors(LOWER_DECK_ROOMS, CORRIDOR_WIDTH)
  for (const corridor of corridors) {
    // Only rooms on the same deck can be clipped. A laboratory seven metres
    // overhead shares an (x, z) footprint with plenty of lower corridors and
    // is in the way of none of them.
    const others = LOWER_DECK_ROOMS.filter((r) => r.id !== corridor.roomAId && r.id !== corridor.roomBId)
    for (let i = 0; i < corridor.points.length - 1; i += 1) {
      const [x1, z1] = corridor.points[i]
      const [x2, z2] = corridor.points[i + 1]
      for (const room of others) {
        assert.equal(
          segmentIntersectsRoom(x1, z1, x2, z2, room, CORRIDOR_WIDTH),
          false,
          `${corridor.roomAId}->${corridor.roomBId} segment ${i} clips ${room.id}`
        )
      }
    }
  }
})

test('corridorExitPoint moves along the shared axis to the room boundary, not the center', () => {
  const room = { center: [0, 0, 0], size: [8, 3, 8] }
  assert.deepEqual(corridorExitPoint(room, 20, 0), [4, 0])
  assert.deepEqual(corridorExitPoint(room, -20, 0), [-4, 0])
  assert.deepEqual(corridorExitPoint(room, 0, 20), [0, 4])
  assert.deepEqual(corridorExitPoint(room, 0, -20), [0, -4])
})
