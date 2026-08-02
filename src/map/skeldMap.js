import * as THREE from 'three'
import { ROOM_LAYOUT } from '../../shared/skeldRooms.js'
import { CORRIDOR_WIDTH, SKELD_CORRIDORS } from '../../shared/skeldCorridors.js'
import { TASK_LOCATIONS, stepPosition } from '../../shared/taskPool.js'
import { VENT_LOCATIONS } from '../../shared/ventPool.js'
import { SHIP_EVENTS, panelPosition } from '../../shared/eventPool.js'
import { addRoomProps } from './roomProps.js'
import { TEXTURES, applyBoxUvScale } from './textures.js'

const WALL_THICKNESS = 0.3
const FLOOR_THICKNESS = 0.2
const CEILING_THICKNESS = 0.2
const WALL_EPSILON = 1e-6

const FLOOR_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x3c4654, roughness: 0.9, map: TEXTURES.floor })
const WALL_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x7c8b9e, roughness: 0.75, map: TEXTURES.wall })
const CEILING_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x2a323d, roughness: 0.95, map: TEXTURES.ceiling })
// Emissive strips do the atmospheric work that per-room point lights would
// otherwise do, at zero per-fragment lighting cost - every MeshStandardMaterial
// evaluates every light in the scene, so 14 room lights would be paid for on
// every surface in view.
const LIGHT_STRIP_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0xdff1ff,
  emissive: 0xbfe4ff,
  emissiveIntensity: 1.4,
})
const TRIM_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x4d5a6b, roughness: 0.6, metalness: 0.3, map: TEXTURES.metal })
const TASK_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0xffcc00,
  emissive: 0xffaa00,
  emissiveIntensity: 0.7,
})
const VENT_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.5, metalness: 0.6 })
const EMERGENCY_BUTTON_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0xdd2222,
  emissive: 0x8a0f0f,
  emissiveIntensity: 0.9,
})

function addFloorSlab(group, centerX, centerZ, width, depth) {
  const geometry = applyBoxUvScale(new THREE.BoxGeometry(width, FLOOR_THICKNESS, depth), width, FLOOR_THICKNESS, depth)
  const mesh = new THREE.Mesh(geometry, FLOOR_MATERIAL)
  mesh.position.set(centerX, -FLOOR_THICKNESS / 2, centerZ)
  group.add(mesh)
}

// Ceilings, trim and light strips are decor, never collision. Two reasons:
// the player can't reach them anyway, and - more importantly - room and
// corridor ceilings necessarily overlap at every junction, which is exactly
// the overlapping-geometry pattern that made the collision Octree recurse to
// its depth limit and exhaust memory (STATE.md L-013). Keeping them out of
// the octree makes that failure structurally impossible rather than
// something to be careful about.
function addCeilingSlab(group, centerX, centerZ, width, depth, height) {
  const geometry = applyBoxUvScale(new THREE.BoxGeometry(width, CEILING_THICKNESS, depth), width, CEILING_THICKNESS, depth)
  const mesh = new THREE.Mesh(geometry, CEILING_MATERIAL)
  mesh.position.set(centerX, height + CEILING_THICKNESS / 2, centerZ)
  group.add(mesh)
}

function addLightStrip(group, centerX, centerZ, width, depth, height) {
  const geometry = new THREE.BoxGeometry(width, 0.06, depth)
  const mesh = new THREE.Mesh(geometry, LIGHT_STRIP_MATERIAL)
  mesh.position.set(centerX, height - 0.05, centerZ)
  group.add(mesh)
}

// Builds a wall as solid segments spanning [rangeStart, rangeEnd] along the
// given axis, leaving a CORRIDOR_WIDTH-wide gap centered at each entry in
// gapCoords (overlapping gaps merge naturally since segments are computed
// from a sorted sweep, not built independently per connection).
function buildWallWithGaps(group, fixedCoord, rangeStart, rangeEnd, height, gapCoords, axis) {
  const sortedGaps = [...gapCoords].sort((a, b) => a - b)
  const segments = []
  let cursor = rangeStart

  for (const gapCenter of sortedGaps) {
    const gapStart = Math.max(rangeStart, gapCenter - CORRIDOR_WIDTH / 2)
    const gapEnd = Math.min(rangeEnd, gapCenter + CORRIDOR_WIDTH / 2)
    if (gapStart > cursor) segments.push([cursor, gapStart])
    cursor = Math.max(cursor, gapEnd)
  }
  if (cursor < rangeEnd) segments.push([cursor, rangeEnd])

  for (const [start, end] of segments) {
    const length = end - start
    if (length <= 0.01) continue
    const center = (start + end) / 2
    const geometry =
      axis === 'x'
        ? applyBoxUvScale(new THREE.BoxGeometry(length, height, WALL_THICKNESS), length, height, WALL_THICKNESS)
        : applyBoxUvScale(new THREE.BoxGeometry(WALL_THICKNESS, height, length), WALL_THICKNESS, height, length)
    const mesh = new THREE.Mesh(geometry, WALL_MATERIAL)
    if (axis === 'x') {
      mesh.position.set(center, height / 2, fixedCoord)
    } else {
      mesh.position.set(fixedCoord, height / 2, center)
    }
    group.add(mesh)
  }
}

// A corridor endpoint sits exactly on one of the room's 4 cardinal walls
// (computeCorridors/corridorExitPoint guarantees this) - this identifies
// which wall and the gap's position along it.
function wallSideAndCoord(room, point) {
  const [x, z] = point
  const [cx, , cz] = room.center
  const [w, , d] = room.size
  if (Math.abs(x - (cx + w / 2)) < WALL_EPSILON) return { side: 'east', coord: z }
  if (Math.abs(x - (cx - w / 2)) < WALL_EPSILON) return { side: 'west', coord: z }
  if (Math.abs(z - (cz + d / 2)) < WALL_EPSILON) return { side: 'north', coord: x }
  return { side: 'south', coord: x }
}

function buildRoomFloor(collision, decor, room, floorRects) {
  const [width, height, depth] = room.size
  const [cx, , cz] = room.center
  addFloorSlab(collision, cx, cz, width, depth)
  floorRects.push({ xMin: cx - width / 2, xMax: cx + width / 2, zMin: cz - depth / 2, zMax: cz + depth / 2 })
  addCeilingSlab(decor, cx, cz, width, depth, height)
  addLightStrip(decor, cx, cz, width * 0.55, 0.35, height)
  addLightStrip(decor, cx, cz, 0.35, depth * 0.55, height)
}

function buildRoom(collision, decor, room, corridors) {
  const [width, height, depth] = room.size
  const [cx, , cz] = room.center
  const gapsBySide = { north: [], south: [], east: [], west: [] }
  for (const corridor of corridors) {
    if (corridor.roomAId === room.id) {
      const { side, coord } = wallSideAndCoord(room, corridor.points[0])
      gapsBySide[side].push(coord)
    }
    if (corridor.roomBId === room.id) {
      const { side, coord } = wallSideAndCoord(room, corridor.points[corridor.points.length - 1])
      gapsBySide[side].push(coord)
    }
  }

  buildWallWithGaps(collision, cz + depth / 2, cx - width / 2, cx + width / 2, height, gapsBySide.north, 'x')
  buildWallWithGaps(collision, cz - depth / 2, cx - width / 2, cx + width / 2, height, gapsBySide.south, 'x')
  buildWallWithGaps(collision, cx + width / 2, cz - depth / 2, cz + depth / 2, height, gapsBySide.east, 'z')
  buildWallWithGaps(collision, cx - width / 2, cz - depth / 2, cz + depth / 2, height, gapsBySide.west, 'z')

  // A dark band where wall meets floor breaks up the flat colour and gives
  // the eye a sense of scale while walking.
  for (const [w, d, ox, oz] of [
    [width, WALL_THICKNESS, 0, depth / 2],
    [width, WALL_THICKNESS, 0, -depth / 2],
    [WALL_THICKNESS, depth, width / 2, 0],
    [WALL_THICKNESS, depth, -width / 2, 0],
  ]) {
    const trim = new THREE.Mesh(new THREE.BoxGeometry(w, 0.18, d), TRIM_MATERIAL)
    trim.position.set(cx + ox, 0.09, cz + oz)
    decor.add(trim)
  }
}

// Three.js's Octree addon subdivides its bounding volume evenly on all 3
// axes regardless of the geometry's shape. A long, thin box (a 50-unit
// corridor run is only 4 units wide) keeps re-intersecting most of the
// octree's children at every subdivision level, so its triangle count never
// drops below the per-leaf threshold before hitting the max split depth -
// the classic "long thin triangle" pathological case, and it made the
// octree build exhaust several GB of memory (reported as the page loading
// forever). Chunking every long run into pieces no longer than the
// corridor's own width keeps every mesh roughly cube-shaped, which is what
// octree subdivision actually needs to shrink triangle counts with depth.
// See STATE.md L-013.
const MAX_SEGMENT_LENGTH = CORRIDOR_WIDTH * 2

// Subtracts `gaps` from the span [start, end], returning the pieces that
// remain. Same sweep buildWallWithGaps uses for doors, reused here for
// corridor walls.
function subtractGaps(start, end, gaps) {
  const sorted = [...gaps].sort((a, b) => a[0] - b[0])
  const pieces = []
  let cursor = start
  for (const [gapStart, gapEnd] of sorted) {
    if (gapEnd <= cursor) continue
    if (gapStart > cursor) pieces.push([cursor, Math.min(gapStart, end)])
    cursor = Math.max(cursor, gapEnd)
    if (cursor >= end) break
  }
  if (cursor < end) pieces.push([cursor, end])
  return pieces.filter(([a, b]) => b - a > 0.05)
}

// How far past a corridor wall to look for floor belonging to something
// else. Room footprints are kept at least a unit clear of corridor edges by
// the router's padding, so this only ever finds a genuine opening.
const WALL_PROBE = 0.3

// One straight, axis-aligned length of corridor - floor only. Walls are a
// separate pass because they need to know about every other piece of floor
// in the map (see buildCorridorWalls).
function buildCorridorFloor(collision, decor, x1, z1, x2, z2, height, floorRects) {
  const length = Math.hypot(x2 - x1, z2 - z1)
  if (length < 0.01) return
  const runsAlongX = z1 === z2

  const chunkCount = Math.max(1, Math.ceil(length / MAX_SEGMENT_LENGTH))
  const chunkLength = length / chunkCount

  for (let i = 0; i < chunkCount; i += 1) {
    const t0 = i / chunkCount
    const t1 = (i + 1) / chunkCount
    const midX = x1 + (x2 - x1) * ((t0 + t1) / 2)
    const midZ = z1 + (z2 - z1) * ((t0 + t1) / 2)
    const w = runsAlongX ? chunkLength : CORRIDOR_WIDTH
    const d = runsAlongX ? CORRIDOR_WIDTH : chunkLength

    const floor = new THREE.Mesh(
      applyBoxUvScale(new THREE.BoxGeometry(w, FLOOR_THICKNESS, d), w, FLOOR_THICKNESS, d),
      FLOOR_MATERIAL
    )
    floor.position.set(midX, -FLOOR_THICKNESS / 2, midZ)
    collision.add(floor)
    floorRects.push({ xMin: midX - w / 2, xMax: midX + w / 2, zMin: midZ - d / 2, zMax: midZ + d / 2 })

    addCeilingSlab(decor, midX, midZ, w, d, height)
    // A continuous glowing line down the middle of every corridor - the
    // strongest single cue that these are built passageways rather than
    // gaps between boxes.
    addLightStrip(
      decor,
      midX,
      midZ,
      runsAlongX ? chunkLength * 0.9 : 0.25,
      runsAlongX ? 0.25 : chunkLength * 0.9,
      height
    )
  }
}

// Corridor walls, cut back wherever there is floor immediately on the other
// side of them.
//
// This is what made bots appear to walk through walls while the player could
// not follow. At every bend, the straight segment's side wall ran the full
// length of its run - straight across the mouth of the perpendicular segment
// it turns into. Bots have no collision and walked through the stub; the
// player's capsule hit it. Measured before the fix: 39 points along the
// corridor centrelines - the exact routes bots walk - were inside a wall.
//
// Building a wall only where nothing is on the far side handles bends,
// corridor-to-corridor junctions, and corridor mouths at rooms with one
// rule, instead of enumerating the cases.
function buildCorridorWalls(collision, x1, z1, x2, z2, height, floorRects) {
  const length = Math.hypot(x2 - x1, z2 - z1)
  if (length < 0.01) return
  const runsAlongX = z1 === z2
  const half = CORRIDOR_WIDTH / 2

  const runStart = runsAlongX ? Math.min(x1, x2) : Math.min(z1, z2)
  const runEnd = runsAlongX ? Math.max(x1, x2) : Math.max(z1, z2)
  const fixed = runsAlongX ? z1 : x1

  for (const side of [1, -1]) {
    const wallCoord = fixed + side * half
    const probe = wallCoord + side * WALL_PROBE

    const gaps = []
    for (const rect of floorRects) {
      const acrossMin = runsAlongX ? rect.zMin : rect.xMin
      const acrossMax = runsAlongX ? rect.zMax : rect.xMax
      if (probe < acrossMin || probe > acrossMax) continue
      const alongMin = runsAlongX ? rect.xMin : rect.zMin
      const alongMax = runsAlongX ? rect.xMax : rect.zMax
      if (alongMax <= runStart || alongMin >= runEnd) continue
      gaps.push([Math.max(runStart, alongMin), Math.min(runEnd, alongMax)])
    }

    for (const [pieceStart, pieceEnd] of subtractGaps(runStart, runEnd, gaps)) {
      const pieceLength = pieceEnd - pieceStart
      const chunks = Math.max(1, Math.ceil(pieceLength / MAX_SEGMENT_LENGTH))
      for (let i = 0; i < chunks; i += 1) {
        const a = pieceStart + (pieceLength * i) / chunks
        const b = pieceStart + (pieceLength * (i + 1)) / chunks
        const mid = (a + b) / 2
        const len = b - a
        const w = runsAlongX ? len : WALL_THICKNESS
        const d = runsAlongX ? WALL_THICKNESS : len
        const wall = new THREE.Mesh(
          applyBoxUvScale(new THREE.BoxGeometry(w, height, d), w, height, d),
          WALL_MATERIAL
        )
        wall.position.set(runsAlongX ? mid : wallCoord, height / 2, runsAlongX ? wallCoord : mid)
        collision.add(wall)
      }
    }
  }
}

// A square, wall-less floor patch at each interior bend, so two
// perpendicular corridor segments always have continuous floor under their
// turn regardless of exactly where each segment's own box ends.
function buildBendPatch(group, x, z, floorRects) {
  const geometry = applyBoxUvScale(new THREE.BoxGeometry(CORRIDOR_WIDTH, FLOOR_THICKNESS, CORRIDOR_WIDTH), CORRIDOR_WIDTH, FLOOR_THICKNESS, CORRIDOR_WIDTH)
  const mesh = new THREE.Mesh(geometry, FLOOR_MATERIAL)
  mesh.position.set(x, -FLOOR_THICKNESS / 2, z)
  group.add(mesh)
  const half = CORRIDOR_WIDTH / 2
  floorRects.push({ xMin: x - half, xMax: x + half, zMin: z - half, zMax: z + half })
}

// Two different logical connections routinely share part of their physical
// path - not just identical detours (lowerEngine->security and
// upperEngine->security both routing past the same obstacle the same way),
// but also two corridors that merely *leave the same room in the same
// direction* before diverging further on (cafeteria->weapons and
// cafeteria->admin both head east along cafeteria's wall before splitting
// off). Building each corridor independently draws that shared stretch
// once per connection, fully or partially overlapping. Overlapping
// geometry can never be separated by any spatial subdivision, which is
// exactly what made the world Octree recurse to its max depth and exhaust
// memory instead of ever bottoming out (see STATE.md L-013).
//
// Fixing only exact-duplicate segments left hundreds of partial overlaps
// (two segments on the same line, covering different but intersecting
// ranges) - the general fix is the same interval-merge sweep
// buildWallWithGaps already uses for door gaps, applied here to merge
// *occupied* ranges instead of *empty* ones: group every segment by the
// line it runs along (axis + fixed coordinate), then collapse each group's
// overlapping/touching ranges into the minimal set of non-overlapping
// spans before any geometry is built.
function mergeRangesOnLine(ranges) {
  const sorted = [...ranges].sort((a, b) => a.start - b.start)
  const merged = []
  for (const range of sorted) {
    const last = merged[merged.length - 1]
    if (last && range.start <= last.end + 1e-6) {
      last.end = Math.max(last.end, range.end)
      last.height = Math.min(last.height, range.height)
    } else {
      merged.push({ ...range })
    }
  }
  return merged
}

function collectCorridorGeometry(corridors, roomsById) {
  const lineGroups = new Map()
  const bendsByKey = new Map()

  for (const corridor of corridors) {
    const roomA = roomsById.get(corridor.roomAId)
    const roomB = roomsById.get(corridor.roomBId)
    const height = Math.min(roomA.size[1], roomB.size[1])
    const points = corridor.points

    for (let i = 0; i < points.length - 1; i += 1) {
      const [x1, z1] = points[i]
      const [x2, z2] = points[i + 1]
      const runsAlongX = z1 === z2
      const lineKey = runsAlongX ? `x:${z1}` : `z:${x1}`
      const start = runsAlongX ? Math.min(x1, x2) : Math.min(z1, z2)
      const end = runsAlongX ? Math.max(x1, x2) : Math.max(z1, z2)

      if (!lineGroups.has(lineKey)) lineGroups.set(lineKey, { runsAlongX, fixed: runsAlongX ? z1 : x1, ranges: [] })
      lineGroups.get(lineKey).ranges.push({ start, end, height })
    }
    for (let i = 1; i < points.length - 1; i += 1) {
      const [x, z] = points[i]
      bendsByKey.set(`${x},${z}`, { x, z })
    }
  }

  const segments = []
  for (const { runsAlongX, fixed, ranges } of lineGroups.values()) {
    for (const merged of mergeRangesOnLine(ranges)) {
      segments.push(
        runsAlongX
          ? { x1: merged.start, z1: fixed, x2: merged.end, z2: fixed, height: merged.height }
          : { x1: fixed, z1: merged.start, x2: fixed, z2: merged.end, height: merged.height }
      )
    }
  }

  return { segments, bends: [...bendsByKey.values()] }
}

function roomPosition(roomId, offset) {
  const room = ROOM_LAYOUT.find((r) => r.id === roomId)
  return [room.center[0] + offset[0], offset[1], room.center[2] + offset[2]]
}

const CONSOLE_BODY_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x55606e, roughness: 0.6, metalness: 0.4 })

// A waist-high console with a glowing screen angled toward the player -
// legible as "something to operate" from across the room, which a floating
// cube was not. The screen carries the interaction userData because it is
// the part a player naturally aims at.
// One console per step. A fetch task therefore places two: the pickup and
// the place it is used. They share the same taskId and differ by stepIndex,
// so the interaction layer knows which one you are standing at.
function addTaskMarkers(group) {
  const meshes = []
  for (const task of TASK_LOCATIONS) {
    task.steps.forEach((step, stepIndex) => {
    const [x, y, z] = stepPosition(ROOM_LAYOUT, task.id, stepIndex)
    const userData = { interactable: true, kind: 'task', taskId: task.id, stepIndex }

    const cabinet = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.5), CONSOLE_BODY_MATERIAL)
    cabinet.position.set(x, y + 0.45, z)
    cabinet.userData = userData
    group.add(cabinet)

    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.5, 0.08), TASK_MATERIAL)
    screen.position.set(x, y + 1.0, z)
    screen.rotation.x = -0.35
    screen.userData = userData
    group.add(screen)

    meshes.push(cabinet, screen)
    })
  }
  return meshes
}

// A recessed floor grate with visible slats, rather than a plain disc.
function addVentMarkers(group) {
  return VENT_LOCATIONS.map((vent) => {
    const [x, y, z] = roomPosition(vent.roomId, vent.offset)
    const userData = { interactable: true, kind: 'vent', ventId: vent.id }

    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 1.1), VENT_MATERIAL)
    frame.position.set(x, y + 0.06, z)
    frame.userData = userData
    group.add(frame)

    for (let i = -1; i <= 1; i += 1) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.14), TRIM_MATERIAL)
      slat.position.set(x, y + 0.14, z + i * 0.3)
      slat.userData = userData
      group.add(slat)
    }
    return frame
  })
}

// A pedestal with a big red dome on top - unmistakable across the cafeteria.
const PANEL_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0xff9d3c,
  emissive: 0xc25a00,
  emissiveIntensity: 0.8,
})

// Emergency panels live on the map permanently. They only respond while
// their event is running - spawning and despawning meshes mid-match would
// mean touching the scene graph (and the interactable list) from a network
// handler, which is a far larger surface than a mesh that is simply inert
// most of the time.
function addEventPanels(group) {
  const meshes = []
  for (const event of SHIP_EVENTS) {
    for (const panel of event.panels) {
      const [x, y, z] = panelPosition(ROOM_LAYOUT, panel.id)
      const userData = { interactable: true, kind: 'eventPanel', panelId: panel.id, eventId: event.id }

      const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.2, 0.5), CONSOLE_BODY_MATERIAL)
      post.position.set(x, y + 0.6, z)
      post.userData = userData
      group.add(post)

      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), PANEL_MATERIAL)
      lamp.position.set(x, y + 1.45, z)
      lamp.userData = userData
      group.add(lamp)

      meshes.push(post, lamp)
    }
  }
  return meshes
}

function addEmergencyButton(group) {
  const [x, y, z] = roomPosition('cafeteria', [0, 0, -3])
  const userData = { interactable: true, kind: 'emergencyButton' }

  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 0.9, 16), CONSOLE_BODY_MATERIAL)
  pedestal.position.set(x, y + 0.45, z)
  pedestal.userData = userData
  group.add(pedestal)

  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), EMERGENCY_BUTTON_MATERIAL)
  dome.position.set(x, y + 0.9, z)
  dome.userData = userData
  group.add(dome)

  return pedestal
}

export function buildSkeldMap() {
  const group = new THREE.Group()
  // Only floors and walls go in `collision`; everything purely visual goes in
  // `decor`. The octree is built from `collision` alone, which keeps ceilings
  // (which necessarily overlap at every room/corridor junction) away from the
  // spatial subdivision that overlapping geometry breaks - see L-013.
  const collision = new THREE.Group()
  const decor = new THREE.Group()
  group.add(collision)
  group.add(decor)

  const corridors = SKELD_CORRIDORS
  const roomsById = new Map(ROOM_LAYOUT.map((room) => [room.id, room]))

  // Two passes. Corridor walls need to know where every other piece of
  // floor is so they can be cut back at openings, so all floor is laid
  // before any corridor wall goes up.
  const floorRects = []
  const { segments, bends } = collectCorridorGeometry(corridors, roomsById)

  for (const room of ROOM_LAYOUT) {
    buildRoomFloor(collision, decor, room, floorRects)
  }
  for (const segment of segments) {
    buildCorridorFloor(collision, decor, segment.x1, segment.z1, segment.x2, segment.z2, segment.height, floorRects)
  }
  for (const bend of bends) {
    buildBendPatch(collision, bend.x, bend.z, floorRects)
  }

  for (const room of ROOM_LAYOUT) {
    buildRoom(collision, decor, room, corridors)
    addRoomProps(decor, room)
  }
  for (const segment of segments) {
    buildCorridorWalls(collision, segment.x1, segment.z1, segment.x2, segment.z2, segment.height, floorRects)
  }

  const taskMeshes = addTaskMarkers(decor)
  const ventMeshes = addVentMarkers(decor)
  const emergencyButton = addEmergencyButton(decor)
  const panelMeshes = addEventPanels(decor)

  const cafeteria = ROOM_LAYOUT.find((room) => room.id === 'cafeteria')
  const spawnPoint = new THREE.Vector3(cafeteria.center[0], 1, cafeteria.center[2])

  return {
    group,
    // Handed to buildWorldOctree instead of `group`: decor must never reach
    // the collision structure.
    collisionGroup: collision,
    spawnPoint,
    interactables: [...taskMeshes, ...ventMeshes, ...panelMeshes, emergencyButton],
  }
}
