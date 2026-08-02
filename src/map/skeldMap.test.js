import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSkeldMap } from './skeldMap.js'
import { buildWorldOctree } from './worldOctree.js'
import { SKELD_CORRIDORS } from '../../shared/skeldCorridors.js'
import { ROOM_LAYOUT } from '../../shared/skeldRooms.js'

// `three` is a devDependency purely so these run. The browser still loads it
// from the CDN import map (AD-003, no build step) - nothing here changes how
// the game ships. It earns its place because this file covers the two bugs
// that have each shipped twice: floor you fall through, and walls across the
// route (STATE.md L-012, L-013, L-016, L-017).

const FLOOR_COLOR = 0x3c4654
const WALL_COLOR = 0x7c8b9e
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
          label: `${corridor.roomAId}->${corridor.roomBId}`,
        })
      }
    }
  }
  return points
}

test('every corridor centreline has floor under it', () => {
  const { floors } = collectBoxes()
  const covered = (x, z) =>
    floors.some((b) => x >= b.min.x - 0.01 && x <= b.max.x + 0.01 && z >= b.min.z - 0.01 && z <= b.max.z + 0.01)

  for (const point of sampleCorridorCentrelines()) {
    assert.ok(covered(point.x, point.z), `${point.label}: no floor at ${point.x.toFixed(2)},${point.z.toFixed(2)}`)
  }
})

test('every room centre has floor under it', () => {
  const { floors } = collectBoxes()
  const covered = (x, z) =>
    floors.some((b) => x >= b.min.x - 0.01 && x <= b.max.x + 0.01 && z >= b.min.z - 0.01 && z <= b.max.z + 0.01)
  for (const room of ROOM_LAYOUT) {
    assert.ok(covered(room.center[0], room.center[2]), `no floor at the centre of ${room.id}`)
  }
})

test('a player-sized body can walk every corridor centreline without hitting a wall', () => {
  // The regression that made bots look like they walked through walls: at
  // every bend, a straight segment's side wall ran across the mouth of the
  // segment it turns into. Bots have no collision and passed through it, so
  // "bot positions are legal" was true while the route was impassable for
  // the player. 39 sample points were inside a wall before the fix.
  const { walls } = collectBoxes()
  const blocked = (x, z) =>
    walls.some(
      (b) =>
        x > b.min.x - PLAYER_RADIUS &&
        x < b.max.x + PLAYER_RADIUS &&
        z > b.min.z - PLAYER_RADIUS &&
        z < b.max.z + PLAYER_RADIUS
    )

  const offenders = sampleCorridorCentrelines()
    .filter((point) => blocked(point.x, point.z))
    .map((point) => `${point.label} @ ${point.x.toFixed(1)},${point.z.toFixed(1)}`)

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
  // above head height.
  const { walls, floors } = collectBoxes()
  for (const box of [...walls, ...floors]) {
    assert.ok(box.min.y < 4.05, `collision geometry found at y=${box.min.y}, above the rooms`)
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

test('a player-sized body can reach all 14 rooms from the spawn', () => {
  // The property the player actually cares about: "não consigo acessar todo
  // o mapa". Centreline sampling cannot prove this - it checks the routes
  // the level designer intended, not whether they connect. This floods the
  // entire walkable area with a player-radius body and checks every room
  // falls inside one connected region.
  const { walls, floors } = collectBoxes()
  const STEP = 0.25

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

  const cafeteria = ROOM_LAYOUT.find((r) => r.id === 'cafeteria')
  const start =
    Math.round((cafeteria.center[2] - zMin) / STEP) * cols + Math.round((cafeteria.center[0] - xMin) / STEP)
  assert.equal(walkable[start], 1, 'the spawn point itself is not walkable')

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

  const unreachable = ROOM_LAYOUT.filter((room) => {
    const i = Math.round((room.center[0] - xMin) / STEP)
    const j = Math.round((room.center[2] - zMin) / STEP)
    return !seen[j * cols + i]
  }).map((room) => room.id)

  assert.deepEqual(unreachable, [], `rooms walled off from the spawn: ${unreachable.join(', ')}`)
})
