import * as THREE from 'three'
import { Capsule } from 'three/addons/math/Capsule.js'
import { normalizeMovementVector, clampPitch } from './movementMath.js'

const GRAVITY = 30
const PLAYER_RADIUS = 0.35
const PLAYER_SEGMENT_HEIGHT = 1.0
// This feeds an exponential-damping model (see updatePhysics), so it behaves
// as an acceleration, not a top speed: terminal velocity converges to
// roughly WALK_ACCELERATION / 4. ~20 gives a moderate walk around 5 u/s.
const WALK_ACCELERATION = 20
const SPRINT_MULTIPLIER = 1.6
const MOUSE_SENSITIVITY = 0.0025
const STEPS_PER_FRAME = 5
const HEAD_BOB_FREQUENCY = 10
const HEAD_BOB_AMPLITUDE = 0.04
const FALL_RESPAWN_Y = -10

export function createPlayerController(camera, worldOctree, spawnPoint) {
  const playerCollider = new Capsule(
    new THREE.Vector3(spawnPoint.x, spawnPoint.y, spawnPoint.z),
    new THREE.Vector3(spawnPoint.x, spawnPoint.y + PLAYER_SEGMENT_HEIGHT, spawnPoint.z),
    PLAYER_RADIUS
  )

  const playerVelocity = new THREE.Vector3()
  const keyStates = {}
  let playerOnFloor = false
  let yaw = 0
  let pitch = 0
  let headBobTime = 0
  let frozen = false

  function playerCollisions() {
    const result = worldOctree.capsuleIntersect(playerCollider)
    playerOnFloor = false
    if (result) {
      playerOnFloor = result.normal.y >= 0.15
      if (!playerOnFloor) {
        playerVelocity.addScaledVector(result.normal, -result.normal.dot(playerVelocity))
      }
      playerCollider.translate(result.normal.multiplyScalar(result.depth))
    }
  }

  function getForwardVector() {
    return new THREE.Vector3(Math.sin(yaw) * -1, 0, Math.cos(yaw) * -1)
  }

  function getRightVector() {
    return new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw) * -1)
  }

  function controls(delta) {
    const forwardInput = (keyStates['KeyW'] ? 1 : 0) - (keyStates['KeyS'] ? 1 : 0)
    const rightInput = (keyStates['KeyD'] ? 1 : 0) - (keyStates['KeyA'] ? 1 : 0)
    const { forward, right } = normalizeMovementVector(forwardInput, rightInput)

    const isSprinting = Boolean(keyStates['ShiftLeft'] || keyStates['ShiftRight'])
    const acceleration = WALK_ACCELERATION * (isSprinting ? SPRINT_MULTIPLIER : 1)
    const speedDelta = delta * acceleration * (playerOnFloor ? 1 : 0.5)

    if (forward !== 0) {
      playerVelocity.addScaledVector(getForwardVector(), forward * speedDelta)
    }
    if (right !== 0) {
      playerVelocity.addScaledVector(getRightVector(), right * speedDelta)
    }
  }

  function updatePhysics(delta) {
    let damping = Math.exp(-4 * delta) - 1
    if (!playerOnFloor) {
      playerVelocity.y -= GRAVITY * delta
      damping *= 0.1
    }
    playerVelocity.addScaledVector(playerVelocity, damping)

    const deltaPosition = playerVelocity.clone().multiplyScalar(delta)
    playerCollider.translate(deltaPosition)
    playerCollisions()
  }

  function teleportPlayerIfOob() {
    if (playerCollider.end.y < FALL_RESPAWN_Y) {
      playerCollider.start.set(spawnPoint.x, spawnPoint.y, spawnPoint.z)
      playerCollider.end.set(spawnPoint.x, spawnPoint.y + PLAYER_SEGMENT_HEIGHT, spawnPoint.z)
      playerVelocity.set(0, 0, 0)
    }
  }

  function applyHeadBob(delta, isMoving) {
    if (isMoving && playerOnFloor) {
      headBobTime += delta * HEAD_BOB_FREQUENCY
      return Math.sin(headBobTime) * HEAD_BOB_AMPLITUDE
    }
    headBobTime = 0
    return 0
  }

  return {
    update(deltaTime) {
      if (frozen) return
      const clampedDelta = Math.min(0.05, deltaTime)
      const subDelta = clampedDelta / STEPS_PER_FRAME

      for (let i = 0; i < STEPS_PER_FRAME; i += 1) {
        controls(subDelta)
        updatePhysics(subDelta)
        teleportPlayerIfOob()
      }

      const forwardInput = (keyStates['KeyW'] ? 1 : 0) - (keyStates['KeyS'] ? 1 : 0)
      const rightInput = (keyStates['KeyD'] ? 1 : 0) - (keyStates['KeyA'] ? 1 : 0)
      const isMoving = forwardInput !== 0 || rightInput !== 0
      const bobOffset = applyHeadBob(clampedDelta, isMoving)

      camera.position.copy(playerCollider.end)
      camera.position.y += bobOffset
      camera.rotation.set(pitch, yaw, 0, 'YXZ')
    },

    handleKeyDown(event) {
      if (frozen) return
      keyStates[event.code] = true
    },

    handleKeyUp(event) {
      keyStates[event.code] = false
    },

    handleMouseMove(event) {
      if (frozen) return
      if (!document.pointerLockElement) return
      yaw -= event.movementX * MOUSE_SENSITIVITY
      pitch = clampPitch(pitch - event.movementY * MOUSE_SENSITIVITY)
    },

    // Position is an eye-height coordinate, matching the "position" convention
    // used for network state (see main.js) - i.e. it maps to the capsule's end.
    teleportTo(position) {
      playerCollider.start.set(position[0], position[1] - PLAYER_SEGMENT_HEIGHT, position[2])
      playerCollider.end.set(position[0], position[1], position[2])
      playerVelocity.set(0, 0, 0)
    },

    setFrozen(value) {
      frozen = value
      if (frozen) {
        for (const key of Object.keys(keyStates)) keyStates[key] = false
      }
    },
  }
}
