import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TASK_LOCATIONS } from './taskPool.js'
import { ROOM_LAYOUT } from '../src/map/skeldRooms.js'

test('exactly 5 task locations with unique ids', () => {
  assert.equal(TASK_LOCATIONS.length, 5)
  const ids = TASK_LOCATIONS.map((task) => task.id)
  assert.equal(new Set(ids).size, 5)
})

test('every task references an existing room id', () => {
  const roomIds = new Set(ROOM_LAYOUT.map((room) => room.id))
  for (const task of TASK_LOCATIONS) {
    assert.ok(roomIds.has(task.roomId), `${task.id} references unknown room "${task.roomId}"`)
  }
})

test('every task has a label and a 3-number offset', () => {
  for (const task of TASK_LOCATIONS) {
    assert.equal(typeof task.label, 'string')
    assert.equal(task.offset.length, 3)
  }
})
