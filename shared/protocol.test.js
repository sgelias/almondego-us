import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MESSAGE_TYPE, isKnownMessageType } from './protocol.js'

test('every MESSAGE_TYPE value is unique', () => {
  const values = Object.values(MESSAGE_TYPE)
  assert.equal(new Set(values).size, values.length)
})

test('isKnownMessageType is true for every declared type', () => {
  for (const type of Object.values(MESSAGE_TYPE)) {
    assert.ok(isKnownMessageType(type), `expected ${type} to be known`)
  }
})

test('isKnownMessageType is false for an unknown type', () => {
  assert.equal(isKnownMessageType('not-a-real-type'), false)
  assert.equal(isKnownMessageType(undefined), false)
})
