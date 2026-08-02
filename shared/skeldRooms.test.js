import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ROOM_LAYOUT } from './skeldRooms.js'

test('contains all 14 Skeld rooms with unique ids', () => {
  assert.equal(ROOM_LAYOUT.length, 14)
  const ids = ROOM_LAYOUT.map((room) => room.id)
  assert.equal(new Set(ids).size, 14)
})

test('every connection references an existing room id', () => {
  const ids = new Set(ROOM_LAYOUT.map((room) => room.id))
  for (const room of ROOM_LAYOUT) {
    for (const connectionId of room.connections) {
      assert.ok(ids.has(connectionId), `${room.id} connects to unknown room "${connectionId}"`)
    }
  }
})

test('every connection is symmetric', () => {
  const byId = new Map(ROOM_LAYOUT.map((room) => [room.id, room]))
  for (const room of ROOM_LAYOUT) {
    for (const connectionId of room.connections) {
      const other = byId.get(connectionId)
      assert.ok(
        other.connections.includes(room.id),
        `${room.id} -> ${connectionId} is not reciprocated by ${connectionId} -> ${room.id}`
      )
    }
  }
})
