import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ROOM_LAYOUT } from './skeldRooms.js'
import { DECKS, deckFloorY, deckOfRoom } from './decks.js'
import { SKELD_STAIRS } from './skeldStairs.js'

test('every room has a unique id', () => {
  const ids = ROOM_LAYOUT.map((room) => room.id)
  assert.equal(new Set(ids).size, ids.length, 'two rooms share an id')
  assert.ok(ROOM_LAYOUT.length >= 14, 'the original deck lost rooms')
})

test("every room sits at its own deck's height", () => {
  for (const room of ROOM_LAYOUT) {
    const deck = deckOfRoom(room)
    assert.ok(DECKS.includes(deck), `${room.id} is on deck ${deck}, which does not exist`)
    assert.equal(
      room.center[1],
      deckFloorY(deck),
      `${room.id} is declared on deck ${deck} but its centre is at y=${room.center[1]}`
    )
  }
})

// A connection that crossed decks would be a corridor running through thin
// air between floors. Stairs are the only vertical link, and they are
// declared separately for exactly that reason.
test('no connection crosses between decks', () => {
  const deckById = new Map(ROOM_LAYOUT.map((room) => [room.id, deckOfRoom(room)]))
  for (const room of ROOM_LAYOUT) {
    for (const other of room.connections) {
      assert.equal(
        deckById.get(other),
        deckOfRoom(room),
        `${room.id} (deck ${deckOfRoom(room)}) connects straight to ${other} (deck ${deckById.get(other)})`
      )
    }
  }
})

test('every stair joins a real room on one deck to a real room on the next', () => {
  const byId = new Map(ROOM_LAYOUT.map((room) => [room.id, room]))
  assert.ok(SKELD_STAIRS.length >= 2, 'one staircase is a single point of failure for a whole deck')
  for (const stair of SKELD_STAIRS) {
    const lower = byId.get(stair.lower)
    const upper = byId.get(stair.upper)
    assert.ok(lower, `${stair.id} starts at unknown room "${stair.lower}"`)
    assert.ok(upper, `${stair.id} ends at unknown room "${stair.upper}"`)
    assert.equal(deckOfRoom(upper), deckOfRoom(lower) + 1, `${stair.id} does not go up exactly one deck`)
  }
})

// Every upper-deck room must be reachable from the lower deck, or a child
// gets a task in a room they cannot walk to.
test('both decks are one connected graph once the stairs are counted', () => {
  const adjacency = new Map(ROOM_LAYOUT.map((room) => [room.id, [...room.connections]]))
  for (const stair of SKELD_STAIRS) {
    adjacency.get(stair.lower).push(stair.upper)
    adjacency.get(stair.upper).push(stair.lower)
  }
  const seen = new Set(['cafeteria'])
  const queue = ['cafeteria']
  for (let head = 0; head < queue.length; head += 1) {
    for (const next of adjacency.get(queue[head]) ?? []) {
      if (seen.has(next)) continue
      seen.add(next)
      queue.push(next)
    }
  }
  const unreachable = ROOM_LAYOUT.filter((room) => !seen.has(room.id)).map((room) => room.id)
  assert.deepEqual(unreachable, [], `unreachable from the spawn: ${unreachable.join(', ')}`)
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
