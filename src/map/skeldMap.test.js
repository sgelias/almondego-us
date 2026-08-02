import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSkeldMap } from './skeldMap.js'
import { buildWorldOctree } from './worldOctree.js'
import { SKELD_CORRIDORS } from '../../shared/skeldCorridors.js'
import { ROOM_LAYOUT } from '../../shared/skeldRooms.js'
import { TASK_LOCATIONS, stepPosition } from '../../shared/taskPool.js'
import { DECKS, DECK_HEIGHT, deckFloorY, deckOfRoom } from '../../shared/decks.js'
import { SKELD_STAIRS, stairPointAt } from '../../shared/skeldStairs.js'
import * as THREE from 'three'
import { createPlayerController } from '../player/playerController.js'
import { createNavGraph } from '../../shared/navGraph.js'

// `three` is a devDependency purely so these run. The browser still loads it
// from the CDN import map (AD-003, no build step) - nothing here changes how
// the game ships. It earns its place because this file covers the two bugs
// that have each shipped twice: floor you fall through, and walls across the
// route (STATE.md L-012, L-013, L-016, L-017).

const FLOOR_COLOR = 0x3c4654
const WALL_COLOR = 0x7c8b9e
// buildStair's RAMP_MATERIAL - the one collidable thing allowed between decks.
const RAMP_COLOR = 0x3a4453
// addCeilingSlab's material.
const CEILING_COLOR = 0x2a323d
// playerController's PLAYER_RADIUS - the geometry has to admit a body of
// this size, not just an infinitely thin point.
const PLAYER_RADIUS = 0.35

function collectBoxes() {
  const { collisionGroup, group } = buildSkeldMap()
  group.updateMatrixWorld(true)
  const walls = []
  const floors = []
  collisionGroup.traverse((object) => {
    if (!object.isMesh) return
    object.geometry.computeBoundingBox()
    const box = object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld)
    if (object.material.color.getHex() === WALL_COLOR) walls.push(box)
    else if (object.material.color.getHex() === FLOOR_COLOR) floors.push(box)
  })
  return { walls, floors, collisionGroup, group }
}

// Which deck a piece of geometry belongs to, by where its underside sits.
function deckOfBox(box) {
  let best = 0
  let bestGap = Infinity
  for (const deck of DECKS) {
    const gap = Math.abs(box.min.y - deckFloorY(deck))
    if (gap < bestGap) {
      bestGap = gap
      best = deck
    }
  }
  return best
}

function boxesForDeck(deck) {
  const { walls, floors } = collectBoxes()
  return {
    walls: walls.filter((b) => deckOfBox(b) === deck),
    floors: floors.filter((b) => deckOfBox(b) === deck),
  }
}

function sampleCorridorCentrelines(step = 0.25) {
  const points = []
  for (const corridor of SKELD_CORRIDORS) {
    for (let i = 0; i < corridor.points.length - 1; i += 1) {
      const [x1, z1] = corridor.points[i]
      const [x2, z2] = corridor.points[i + 1]
      const steps = Math.max(2, Math.ceil(Math.hypot(x2 - x1, z2 - z1) / step))
      for (let s = 0; s <= steps; s += 1) {
        const t = s / steps
        points.push({
          x: x1 + (x2 - x1) * t,
          z: z1 + (z2 - z1) * t,
          deck: corridor.deck ?? 0,
          label: `${corridor.roomAId}->${corridor.roomBId}`,
        })
      }
    }
  }
  return points
}

// Coverage is checked per deck. Pooling both decks' floors would let a slab
// on the science deck "cover" a hole in the deck below it.
function floorCoverage(deck) {
  const { floors } = boxesForDeck(deck)
  return (x, z) =>
    floors.some((b) => x >= b.min.x - 0.01 && x <= b.max.x + 0.01 && z >= b.min.z - 0.01 && z <= b.max.z + 0.01)
}

test('every corridor centreline has floor under it, on its own deck', () => {
  const coveredOn = new Map(DECKS.map((deck) => [deck, floorCoverage(deck)]))
  for (const point of sampleCorridorCentrelines()) {
    assert.ok(
      coveredOn.get(point.deck)(point.x, point.z),
      `${point.label} (deck ${point.deck}): no floor at ${point.x.toFixed(2)},${point.z.toFixed(2)}`
    )
  }
})

test('every room centre has floor under it, on its own deck', () => {
  const coveredOn = new Map(DECKS.map((deck) => [deck, floorCoverage(deck)]))
  for (const room of ROOM_LAYOUT) {
    assert.ok(
      coveredOn.get(deckOfRoom(room))(room.center[0], room.center[2]),
      `no floor at the centre of ${room.id} (deck ${deckOfRoom(room)})`
    )
  }
})

test('a player-sized body can walk every corridor centreline without hitting a wall', () => {
  // The regression that made bots look like they walked through walls: at
  // every bend, a straight segment's side wall ran across the mouth of the
  // segment it turns into. Bots have no collision and passed through it, so
  // "bot positions are legal" was true while the route was impassable for
  // the player. 39 sample points were inside a wall before the fix.
  // Per deck: a wall on the science deck is not in the way of a corridor
  // seven metres below it.
  const blockedOn = new Map(
    DECKS.map((deck) => {
      const { walls } = boxesForDeck(deck)
      return [
        deck,
        (x, z) =>
          walls.some(
            (b) =>
              x > b.min.x - PLAYER_RADIUS &&
              x < b.max.x + PLAYER_RADIUS &&
              z > b.min.z - PLAYER_RADIUS &&
              z < b.max.z + PLAYER_RADIUS
          ),
      ]
    })
  )

  const offenders = sampleCorridorCentrelines()
    .filter((point) => blockedOn.get(point.deck)(point.x, point.z))
    .map((point) => `${point.label} @ ${point.x.toFixed(1)},${point.z.toFixed(1)} (deck ${point.deck})`)

  assert.deepEqual(offenders, [], `corridor route blocked for a player at: ${offenders.slice(0, 8).join('; ')}`)
})

test('decor never reaches the collision group', () => {
  // AD-007: ceilings and props overlap constantly at junctions, and
  // overlapping geometry is what made the Octree exhaust memory (L-013).
  const { collisionGroup, group } = collectBoxes()
  let total = 0
  let collision = 0
  group.traverse((o) => {
    if (o.isMesh) total += 1
  })
  collisionGroup.traverse((o) => {
    if (o.isMesh) collision += 1
  })
  assert.ok(collision > 0, 'nothing at all in the collision group')
  assert.ok(collision < total, 'everything ended up in the collision group - the decor split is gone')

  // No ceiling should be collidable: nothing in the collision group may sit
  // above head height *of its own deck*. Ramps are the deliberate exception -
  // a stair spans the gap between decks by definition - so they are matched
  // by colour and checked separately.
  for (const deck of DECKS) {
    const { walls, floors } = boxesForDeck(deck)
    for (const box of [...walls, ...floors]) {
      assert.ok(
        box.min.y < deckFloorY(deck) + 4.05,
        `collision geometry found at y=${box.min.y}, above deck ${deck}'s rooms`
      )
    }
  }
})

test('a stair spans exactly one deck, and its collider is a ramp rather than steps', () => {
  const { collisionGroup, group } = buildSkeldMap()
  group.updateMatrixWorld(true)
  const ramps = []
  collisionGroup.traverse((object) => {
    if (!object.isMesh) return
    if (object.material.color.getHex() !== RAMP_COLOR) return
    object.geometry.computeBoundingBox()
    ramps.push(object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld))
  })

  assert.equal(ramps.length, SKELD_STAIRS.length, 'a stairwell has no ramp to walk on')
  for (const box of ramps) {
    const rise = box.max.y - box.min.y
    assert.ok(rise > DECK_HEIGHT * 0.8, `a ramp only rises ${rise.toFixed(1)}, short of a full deck`)
    assert.ok(box.min.y < 0.6, 'a ramp does not reach the lower deck floor')
    assert.ok(box.max.y > DECK_HEIGHT - 0.6, 'a ramp does not reach the upper deck floor')
  }
})

test('no stairwell has a ceiling for its ramp to pierce', () => {
  const { group } = buildSkeldMap()
  group.updateMatrixWorld(true)
  const ceilings = []
  group.traverse((object) => {
    if (!object.isMesh) return
    if (object.material.color.getHex() !== CEILING_COLOR) return
    object.geometry.computeBoundingBox()
    ceilings.push(object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld))
  })
  assert.ok(ceilings.length > 0, 'no ceilings at all - this test is checking nothing')

  for (const stair of SKELD_STAIRS) {
    // Sample up the ramp and check nothing roofs it over below head height.
    for (let step = 1; step < 10; step += 1) {
      const [x, y, z] = stairPointAt(stair, step / 10)
      const pierced = ceilings.find(
        (b) => x >= b.min.x && x <= b.max.x && z >= b.min.z && z <= b.max.z && b.min.y > y && b.min.y < y + 2.2
      )
      assert.ok(!pierced, `${stair.id}: a ceiling cuts across the ramp at y=${y.toFixed(1)}`)
    }
  }
})

test('the collision octree builds without exhausting memory', () => {
  // L-013: overlapping geometry made this recurse to its depth limit and
  // OOM. It is not a timing assertion (that would be flaky) - simply
  // completing is the property that regressed.
  const { collisionGroup } = collectBoxes()
  const octree = buildWorldOctree(collisionGroup)
  assert.ok(octree, 'octree failed to build')
})

test('a player-sized body can reach every room on its own deck', () => {
  // The property the player actually cares about: "não consigo acessar todo
  // o mapa". Centreline sampling cannot prove this - it checks the routes
  // the level designer intended, not whether they connect. This floods the
  // walkable area with a player-radius body and checks every room falls
  // inside one connected region.
  //
  // Run per deck. The vertical link between the two regions is not a grid
  // neighbour, so it is proven separately by actually walking a capsule up
  // the ramp in the test below - between them the two cover the whole ship.
  const STEP = 0.25

  for (const deck of DECKS) {
    const { walls, floors } = boxesForDeck(deck)
    const rooms = ROOM_LAYOUT.filter((room) => deckOfRoom(room) === deck)

    let xMin = Infinity
    let xMax = -Infinity
    let zMin = Infinity
    let zMax = -Infinity
    for (const b of floors) {
      xMin = Math.min(xMin, b.min.x)
      xMax = Math.max(xMax, b.max.x)
      zMin = Math.min(zMin, b.min.z)
      zMax = Math.max(zMax, b.max.z)
    }
    const cols = Math.ceil((xMax - xMin) / STEP) + 1
    const rows = Math.ceil((zMax - zMin) / STEP) + 1

    const onFloor = (x, z) => floors.some((b) => x >= b.min.x && x <= b.max.x && z >= b.min.z && z <= b.max.z)
    const clear = (x, z) =>
      !walls.some(
        (b) =>
          x > b.min.x - PLAYER_RADIUS &&
          x < b.max.x + PLAYER_RADIUS &&
          z > b.min.z - PLAYER_RADIUS &&
          z < b.max.z + PLAYER_RADIUS
      )

    const walkable = new Uint8Array(cols * rows)
    for (let j = 0; j < rows; j += 1) {
      for (let i = 0; i < cols; i += 1) {
        const x = xMin + i * STEP
        const z = zMin + j * STEP
        if (onFloor(x, z) && clear(x, z)) walkable[j * cols + i] = 1
      }
    }

    const seed = rooms[0]
    const start =
      Math.round((seed.center[2] - zMin) / STEP) * cols + Math.round((seed.center[0] - xMin) / STEP)
    assert.equal(walkable[start], 1, `deck ${deck}: the seed room ${seed.id} is not walkable`)

    const seen = new Uint8Array(cols * rows)
    const queue = [start]
    seen[start] = 1
    for (let head = 0; head < queue.length; head += 1) {
      const cell = queue[head]
      const ci = cell % cols
      const cj = Math.floor(cell / cols)
      for (const [ni, nj] of [
        [ci + 1, cj],
        [ci - 1, cj],
        [ci, cj + 1],
        [ci, cj - 1],
      ]) {
        if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue
        const next = nj * cols + ni
        if (seen[next] || !walkable[next]) continue
        seen[next] = 1
        queue.push(next)
      }
    }

    const unreachable = rooms
      .filter((room) => {
        const i = Math.round((room.center[0] - xMin) / STEP)
        const j = Math.round((room.center[2] - zMin) / STEP)
        return !seen[j * cols + i]
      })
      .map((room) => room.id)

    assert.deepEqual(unreachable, [], `deck ${deck}: rooms walled off - ${unreachable.join(', ')}`)
  }
})

// The one property no amount of box arithmetic can establish: that a player
// can actually get upstairs. This drives the real controller, with real
// gravity and the real octree, up each ramp - the same thing a child does by
// holding W. It is the vertical half of the connectivity proof above.
test('a player can walk up every staircase, and back down again', () => {
  const { collisionGroup, group } = buildSkeldMap()
  group.updateMatrixWorld(true)
  const octree = buildWorldOctree(collisionGroup)
  const nav = createNavGraph(ROOM_LAYOUT, SKELD_CORRIDORS)
  // handleMouseMove ignores input unless the pointer is locked.
  global.document = { pointerLockElement: {} }

  try {
  for (const stair of SKELD_STAIRS) {
    const foot = stairPointAt(stair, 0)
    const top = stairPointAt(stair, 1)
    // Start a little before the foot, on the flat, facing up the ramp.
    const climbingPositive = top[2] > foot[2]
    const startZ = foot[2] + (climbingPositive ? -2 : 2)

    const camera = new THREE.PerspectiveCamera()
    const player = createPlayerController(camera, octree, new THREE.Vector3(foot[0], 1, startZ))
    // Yaw 0 walks toward -z; a half turn walks toward +z.
    player.handleMouseMove({ movementX: climbingPositive ? Math.PI / 0.0025 : 0, movementY: 0 })
    player.handleKeyDown({ code: 'KeyW' })

    let peak = -Infinity
    // Long enough to climb AND keep walking off the top. Height alone is not
    // the property that matters: the first version of this test asserted only
    // that the player got high enough, and passed while every staircase
    // delivered you into a blank wall with no doorway - which is precisely
    // what a player reported. Arriving *inside the room* is the real check.
    for (let i = 0; i < 30 * 60; i += 1) {
      player.update(1 / 60)
      peak = Math.max(peak, camera.position.y)
    }
    assert.ok(
      peak > DECK_HEIGHT,
      `${stair.id}: walking up the stairs only reached y=${peak.toFixed(2)}, short of the upper deck at ${DECK_HEIGHT}`
    )
    const arrived = nav.roomIdAt([camera.position.x, camera.position.y, camera.position.z])
    assert.equal(
      arrived,
      stair.upper,
      `${stair.id}: the climb ended in ${arrived ?? 'no room at all'} rather than ${stair.upper} - ` +
        'the player got up the stairs but could not get off them'
    )

    // And down: from the top landing, walking back the other way must not
    // drop the player through the ramp into the deck below.
    const back = createPlayerController(
      camera,
      octree,
      new THREE.Vector3(top[0], DECK_HEIGHT + 1, top[2] + (climbingPositive ? 1 : -1))
    )
    back.handleMouseMove({ movementX: climbingPositive ? 0 : Math.PI / 0.0025, movementY: 0 })
    back.handleKeyDown({ code: 'KeyW' })
    let lowest = Infinity
    for (let i = 0; i < 15 * 60; i += 1) {
      back.update(1 / 60)
      lowest = Math.min(lowest, camera.position.y)
    }
    assert.ok(lowest > -1, `${stair.id}: walking down fell through the world to y=${lowest.toFixed(2)}`)
  }
  } finally {
    delete global.document
  }
})

// A window is the one place the wall is deliberately open, so it is the one
// place worth proving you still cannot get out. The pane is thin; a capsule
// moving at sprint speed is exactly what tunnels through thin geometry.
test('you can see out of a window but not walk out of one', () => {
  const { collisionGroup, group } = buildSkeldMap()
  group.updateMatrixWorld(true)
  const octree = buildWorldOctree(collisionGroup)
  global.document = { pointerLockElement: {} }

  try {
    for (const room of ROOM_LAYOUT.filter((r) => r.windows?.length)) {
      for (const side of room.windows) {
        const [width, , depth] = room.size
        const [cx, , cz] = room.center
        const horizontal = side === 'north' || side === 'south'
        const sign = side === 'north' || side === 'east' ? 1 : -1
        // Start inside, a couple of metres back, facing the glass.
        const start = new THREE.Vector3(
          horizontal ? cx : cx + sign * (width / 2 - 2.5),
          deckFloorY(deckOfRoom(room)) + 1,
          horizontal ? cz + sign * (depth / 2 - 2.5) : cz
        )
        const camera = new THREE.PerspectiveCamera()
        const player = createPlayerController(camera, octree, start)
        const yaw = { north: Math.PI, south: 0, east: -Math.PI / 2, west: Math.PI / 2 }[side]
        player.handleMouseMove({ movementX: -yaw / 0.0025, movementY: 0 })
        player.handleKeyDown({ code: 'KeyW' })
        player.handleKeyDown({ code: 'ShiftLeft' }) // sprinting: the tunnelling case
        for (let i = 0; i < 8 * 60; i += 1) player.update(1 / 60)

        const outside = horizontal
          ? sign * (camera.position.z - cz) > depth / 2
          : sign * (camera.position.x - cx) > width / 2
        assert.ok(
          !outside,
          `${room.id}'s ${side} window let a sprinting player straight out into space ` +
            `(ended at ${camera.position.x.toFixed(1)}, ${camera.position.z.toFixed(1)})`
        )
      }
    }
  } finally {
    delete global.document
  }
})

test('a task guide arrow would point exactly at the real console', () => {
  // The guide computes a task's world position from ROOM_LAYOUT + offset,
  // while skeldMap places the actual console mesh. Those are two separate
  // calculations: if they ever drift, the arrow points at empty floor and
  // the player is sent to the wrong spot with full confidence.
  const { interactables } = buildSkeldMap()

  for (const task of TASK_LOCATIONS) {
    for (let stepIndex = 0; stepIndex < task.steps.length; stepIndex += 1) {
      const [guideX, , guideZ] = stepPosition(ROOM_LAYOUT, task.id, stepIndex)

      const consoleMeshes = interactables.filter(
        (mesh) =>
          mesh.userData?.kind === 'task' &&
          mesh.userData.taskId === task.id &&
          mesh.userData.stepIndex === stepIndex
      )
      assert.ok(consoleMeshes.length > 0, `no console mesh for ${task.id} step ${stepIndex}`)

      for (const mesh of consoleMeshes) {
        assert.ok(
          Math.abs(mesh.position.x - guideX) < 0.01 && Math.abs(mesh.position.z - guideZ) < 0.01,
          `${task.id} step ${stepIndex}: guide points at ${guideX},${guideZ} but the console is at ${mesh.position.x},${mesh.position.z}`
        )
      }
    }
  }
})

test('every task console sits inside its own room, not in a wall', () => {
  for (const task of TASK_LOCATIONS) {
    for (const [index, step] of task.steps.entries()) {
      const room = ROOM_LAYOUT.find((r) => r.id === step.roomId)
      assert.ok(room, `${task.id} step ${index} references a room that does not exist`)
      const x = room.center[0] + step.offset[0]
      const z = room.center[2] + step.offset[2]
      // A console flush against a wall cannot be walked up to from every side.
      const margin = 1.0
      assert.ok(
        Math.abs(x - room.center[0]) < room.size[0] / 2 - margin &&
          Math.abs(z - room.center[2]) < room.size[2] / 2 - margin,
        `${task.id} step ${index} is too close to ${room.id}'s wall to reach comfortably`
      )
    }
  }
})
