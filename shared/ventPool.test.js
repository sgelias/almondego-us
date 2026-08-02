import { test } from 'node:test'
import assert from 'node:assert/strict'
import { VENT_LOCATIONS, getVentDestination } from './ventPool.js'
import { ROOM_LAYOUT } from './skeldRooms.js'

test('every group has at least 2 vents', () => {
  const groups = new Map()
  for (const vent of VENT_LOCATIONS) {
    if (!groups.has(vent.group)) groups.set(vent.group, [])
    groups.get(vent.group).push(vent)
  }
  for (const [group, vents] of groups) {
    assert.ok(vents.length >= 2, `group ${group} has fewer than 2 vents`)
  }
})

test('every vent references an existing room id', () => {
  const roomIds = new Set(ROOM_LAYOUT.map((room) => room.id))
  for (const vent of VENT_LOCATIONS) {
    assert.ok(roomIds.has(vent.roomId), `${vent.id} references unknown room "${vent.roomId}"`)
  }
})

test('getVentDestination cycles through a 2-vent group', () => {
  const twoVentGroup = findGroupOfSize(2)
  const [a, b] = twoVentGroup
  assert.equal(getVentDestination(a.id), b.id)
  assert.equal(getVentDestination(b.id), a.id)
})

test('getVentDestination cycles through a 3-vent group', () => {
  const threeVentGroup = findGroupOfSize(3)
  const [a, b, c] = threeVentGroup
  assert.equal(getVentDestination(a.id), b.id)
  assert.equal(getVentDestination(b.id), c.id)
  assert.equal(getVentDestination(c.id), a.id)
})

test('getVentDestination returns null for an unknown vent', () => {
  assert.equal(getVentDestination('not-a-real-vent'), null)
})

function findGroupOfSize(size) {
  const groups = new Map()
  for (const vent of VENT_LOCATIONS) {
    if (!groups.has(vent.group)) groups.set(vent.group, [])
    groups.get(vent.group).push(vent)
  }
  for (const vents of groups.values()) {
    if (vents.length === size) return vents
  }
  throw new Error(`no group of size ${size} found`)
}
