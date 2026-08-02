const PITCH_LIMIT = Math.PI / 2 - 0.01

export function normalizeMovementVector(forward, right) {
  const magnitude = Math.hypot(forward, right)
  if (magnitude <= 1 || magnitude === 0) {
    return { forward, right }
  }
  return { forward: forward / magnitude, right: right / magnitude }
}

export function clampPitch(pitch) {
  return Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch))
}
