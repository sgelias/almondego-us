import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TASK_LOCATIONS, getTaskById, stepCount, stepPosition } from './taskPool.js'
import { ROOM_LAYOUT } from './skeldRooms.js'

test('there are enough tasks to assign three distinct ones, with unique ids', () => {
  assert.ok(TASK_LOCATIONS.length >= 3)
  assert.equal(new Set(TASK_LOCATIONS.map((t) => t.id)).size, TASK_LOCATIONS.length)
})

test('every task has a label and at least one step', () => {
  for (const task of TASK_LOCATIONS) {
    assert.ok(task.label && task.label.length > 4, `${task.id} has no readable label`)
    assert.ok(Array.isArray(task.steps) && task.steps.length >= 1, `${task.id} has no steps`)
  }
})

test('every step references an existing room and carries a verb', () => {
  const roomIds = new Set(ROOM_LAYOUT.map((r) => r.id))
  for (const task of TASK_LOCATIONS) {
    for (const [index, step] of task.steps.entries()) {
      assert.ok(roomIds.has(step.roomId), `${task.id} step ${index} points at unknown room ${step.roomId}`)
      assert.ok(step.verb && step.verb.length > 3, `${task.id} step ${index} has no verb to show the player`)
      assert.equal(step.offset.length, 3, `${task.id} step ${index} has a malformed offset`)
    }
  }
})

test('multi-step tasks send the player to a DIFFERENT room, otherwise the trip is pointless', () => {
  for (const task of TASK_LOCATIONS) {
    if (task.steps.length < 2) continue
    const rooms = task.steps.map((s) => s.roomId)
    assert.equal(new Set(rooms).size, rooms.length, `${task.id} revisits the same room across steps`)
  }
})

test('at least one task is multi-step', () => {
  assert.ok(TASK_LOCATIONS.some((t) => t.steps.length > 1), 'no fetch-and-carry task exists')
})

test('every non-final step declares what the player is carrying', () => {
  // The HUD tells the player what is in their hands; a step without it would
  // leave them walking across the ship holding nothing they can name.
  for (const task of TASK_LOCATIONS) {
    for (let i = 0; i < task.steps.length - 1; i += 1) {
      assert.ok(task.steps[i].carrying, `${task.id} step ${i} does not say what is picked up`)
    }
  }
})

test('stepCount and getTaskById agree with the data', () => {
  for (const task of TASK_LOCATIONS) {
    assert.equal(getTaskById(task.id)?.id, task.id)
    assert.equal(stepCount(task.id), task.steps.length)
  }
  assert.equal(getTaskById('nao-existe'), null)
  assert.equal(stepCount('nao-existe'), 0)
})

test('stepPosition places every step inside its own room, away from the walls', () => {
  for (const task of TASK_LOCATIONS) {
    for (let i = 0; i < task.steps.length; i += 1) {
      const position = stepPosition(ROOM_LAYOUT, task.id, i)
      assert.ok(position, `${task.id} step ${i} has no position`)
      const room = ROOM_LAYOUT.find((r) => r.id === task.steps[i].roomId)
      const margin = 1.0
      assert.ok(
        Math.abs(position[0] - room.center[0]) < room.size[0] / 2 - margin &&
          Math.abs(position[2] - room.center[2]) < room.size[2] / 2 - margin,
        `${task.id} step ${i} sits too close to ${room.id}'s wall to walk up to`
      )
    }
  }
})

test('stepPosition returns null rather than guessing for unknown input', () => {
  assert.equal(stepPosition(ROOM_LAYOUT, 'nao-existe', 0), null)
  assert.equal(stepPosition(ROOM_LAYOUT, TASK_LOCATIONS[0].id, 99), null)
})
