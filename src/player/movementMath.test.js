import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeMovementVector, clampPitch } from './movementMath.js'

test('normalizeMovementVector leaves cardinal input unchanged', () => {
  const result = normalizeMovementVector(1, 0)
  assert.equal(result.forward, 1)
  assert.equal(result.right, 0)
})

test('normalizeMovementVector scales diagonal input to magnitude 1', () => {
  const result = normalizeMovementVector(1, 1)
  const magnitude = Math.hypot(result.forward, result.right)
  assert.ok(Math.abs(magnitude - 1) < 1e-9, `expected magnitude ~1, got ${magnitude}`)
  assert.ok(Math.abs(result.forward - result.right) < 1e-9)
})

test('normalizeMovementVector leaves zero input as zero', () => {
  const result = normalizeMovementVector(0, 0)
  assert.equal(result.forward, 0)
  assert.equal(result.right, 0)
})

test('normalizeMovementVector never exceeds magnitude 1', () => {
  const result = normalizeMovementVector(1, 1)
  assert.ok(Math.hypot(result.forward, result.right) <= 1 + 1e-9)
})

test('clampPitch leaves in-range values unchanged', () => {
  assert.equal(clampPitch(0.5), 0.5)
  assert.equal(clampPitch(-0.5), -0.5)
})

test('clampPitch clamps values at or beyond +90 degrees', () => {
  const clamped = clampPitch(Math.PI)
  assert.ok(clamped < Math.PI / 2)
})

test('clampPitch clamps values at or beyond -90 degrees', () => {
  const clamped = clampPitch(-Math.PI)
  assert.ok(clamped > -Math.PI / 2)
})
