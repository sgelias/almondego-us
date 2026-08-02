import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SHIP_EVENTS, getEventById, getPanel, pickEvent, panelPosition, ARM_WINDOW_SECONDS } from './eventPool.js'
import { ROOM_LAYOUT } from './skeldRooms.js'

function seededRandom(seed) {
  let state = seed
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff
    return state / 0x7fffffff
  }
}

test('every event is described well enough for a child to know what to do', () => {
  assert.ok(SHIP_EVENTS.length >= 2)
  assert.equal(new Set(SHIP_EVENTS.map((e) => e.id)).size, SHIP_EVENTS.length)
  for (const event of SHIP_EVENTS) {
    assert.ok(event.name.length > 4, `${event.id} has no name`)
    assert.ok(event.description.length > 25, `${event.id}'s description does not say what to do`)
    assert.ok(event.durationSeconds >= 20, `${event.id} is too short to cross the ship for`)
    assert.ok(event.panels.length >= 1, `${event.id} has no way to fix it`)
  }
})

test('panel ids are unique across all events', () => {
  const ids = SHIP_EVENTS.flatMap((e) => e.panels.map((p) => p.id))
  assert.equal(new Set(ids).size, ids.length)
})

test('a multi-panel event puts its panels in different rooms', () => {
  for (const event of SHIP_EVENTS) {
    if (event.panels.length < 2) continue
    const rooms = event.panels.map((p) => p.roomId)
    assert.equal(new Set(rooms).size, rooms.length, `${event.id} puts two panels in one room, so one player could do both`)
  }
})

test('every panel sits inside a real room, away from the walls', () => {
  for (const event of SHIP_EVENTS) {
    for (const panel of event.panels) {
      const room = ROOM_LAYOUT.find((r) => r.id === panel.roomId)
      assert.ok(room, `${panel.id} references unknown room ${panel.roomId}`)
      const position = panelPosition(ROOM_LAYOUT, panel.id)
      const margin = 1.0
      assert.ok(
        Math.abs(position[0] - room.center[0]) < room.size[0] / 2 - margin &&
          Math.abs(position[2] - room.center[2]) < room.size[2] / 2 - margin,
        `${panel.id} is too close to ${room.id}'s wall to walk up to`
      )
    }
  }
})

test('the two-person event is achievable: the arm window is long enough to cross the ship', () => {
  // At the walking speed bots use (4.5 u/s) the map's longest room-to-room
  // trip is well under this. If the window were shorter the event would be
  // impossible rather than hard.
  assert.ok(ARM_WINDOW_SECONDS >= 8, 'two children in two rooms cannot coordinate faster than this')
})

test('getEventById and getPanel resolve real data and nothing else', () => {
  for (const event of SHIP_EVENTS) {
    assert.equal(getEventById(event.id)?.id, event.id)
    for (const panel of event.panels) {
      assert.equal(getPanel(panel.id)?.event.id, event.id)
    }
  }
  assert.equal(getEventById('nao-existe'), null)
  assert.equal(getPanel('nao-existe'), null)
  assert.equal(panelPosition(ROOM_LAYOUT, 'nao-existe'), null)
})

test('pickEvent reaches every event', () => {
  const seen = new Set()
  for (let seed = 1; seed <= 300; seed += 1) seen.add(pickEvent(seededRandom(seed)))
  assert.equal(seen.size, SHIP_EVENTS.length)
})
