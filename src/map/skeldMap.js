import * as THREE from 'three'
import { ROOM_LAYOUT } from '../../shared/skeldRooms.js'
import { computeCorridors } from '../../shared/corridorRouting.js'
import { TASK_LOCATIONS } from '../../shared/taskPool.js'
import { VENT_LOCATIONS } from '../../shared/ventPool.js'

const WALL_THICKNESS = 0.3
const CORRIDOR_WIDTH = 4
const FLOOR_THICKNESS = 0.2
const WALL_EPSILON = 1e-6

const FLOOR_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x445566 })
const WALL_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x8899aa })
const TASK_MATERIAL = new THREE.MeshStandardMaterial({ color: 0xffcc00 })
const VENT_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x333333 })
const EMERGENCY_BUTTON_MATERIAL = new THREE.MeshStandardMaterial({ color: 0xdd2222 })

// upperEngine-reactor's straight/single-bend routes both tunnel through
// lowerEngine (it sits directly between them); the BFS router handles every
// other connection but this one needs a hand-authored detour around it.
const CORRIDOR_OVERRIDES = {
  'reactor->upperEngine': [
    [-33, 11],
    [-25, 11],
    [-25, -33],
    [-33, -33],
  ],
}

function addFloorSlab(group, centerX, centerZ, width, depth) {
  const geometry = new THREE.BoxGeometry(width, FLOOR_THICKNESS, depth)
  const mesh = new THREE.Mesh(geometry, FLOOR_MATERIAL)
  mesh.position.set(centerX, -FLOOR_THICKNESS / 2, centerZ)
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
        ? new THREE.BoxGeometry(length, height, WALL_THICKNESS)
        : new THREE.BoxGeometry(WALL_THICKNESS, height, length)
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

function buildRoom(group, room, corridors) {
  const [width, height, depth] = room.size
  const [cx, , cz] = room.center

  addFloorSlab(group, cx, cz, width, depth)

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

  buildWallWithGaps(group, cz + depth / 2, cx - width / 2, cx + width / 2, height, gapsBySide.north, 'x')
  buildWallWithGaps(group, cz - depth / 2, cx - width / 2, cx + width / 2, height, gapsBySide.south, 'x')
  buildWallWithGaps(group, cx + width / 2, cz - depth / 2, cz + depth / 2, height, gapsBySide.east, 'z')
  buildWallWithGaps(group, cx - width / 2, cz - depth / 2, cz + depth / 2, height, gapsBySide.west, 'z')
}

// One straight, axis-aligned length of corridor between two consecutive
// waypoints - floor plus a wall down each side. Direction is inferred from
// which coordinate is constant between the two points (both are guaranteed
// equal on one axis - see corridorRouting.js).
function buildCorridorSegment(group, x1, z1, x2, z2, height) {
  const length = Math.hypot(x2 - x1, z2 - z1)
  if (length < 0.01) return
  const midX = (x1 + x2) / 2
  const midZ = (z1 + z2) / 2
  const runsAlongX = z1 === z2

  const floorGeometry = runsAlongX
    ? new THREE.BoxGeometry(length, FLOOR_THICKNESS, CORRIDOR_WIDTH)
    : new THREE.BoxGeometry(CORRIDOR_WIDTH, FLOOR_THICKNESS, length)
  const floor = new THREE.Mesh(floorGeometry, FLOOR_MATERIAL)
  floor.position.set(midX, -FLOOR_THICKNESS / 2, midZ)
  group.add(floor)

  if (runsAlongX) {
    const wallGeometry = new THREE.BoxGeometry(length, height, WALL_THICKNESS)
    const wallNorth = new THREE.Mesh(wallGeometry, WALL_MATERIAL)
    wallNorth.position.set(midX, height / 2, midZ + CORRIDOR_WIDTH / 2)
    group.add(wallNorth)
    const wallSouth = new THREE.Mesh(wallGeometry.clone(), WALL_MATERIAL)
    wallSouth.position.set(midX, height / 2, midZ - CORRIDOR_WIDTH / 2)
    group.add(wallSouth)
  } else {
    const wallGeometry = new THREE.BoxGeometry(WALL_THICKNESS, height, length)
    const wallEast = new THREE.Mesh(wallGeometry, WALL_MATERIAL)
    wallEast.position.set(midX + CORRIDOR_WIDTH / 2, height / 2, midZ)
    group.add(wallEast)
    const wallWest = new THREE.Mesh(wallGeometry.clone(), WALL_MATERIAL)
    wallWest.position.set(midX - CORRIDOR_WIDTH / 2, height / 2, midZ)
    group.add(wallWest)
  }
}

// A square, wall-less floor patch at each interior bend, so two
// perpendicular corridor segments always have continuous floor under their
// turn regardless of exactly where each segment's own box ends.
function buildBendPatch(group, x, z) {
  const geometry = new THREE.BoxGeometry(CORRIDOR_WIDTH, FLOOR_THICKNESS, CORRIDOR_WIDTH)
  const mesh = new THREE.Mesh(geometry, FLOOR_MATERIAL)
  mesh.position.set(x, -FLOOR_THICKNESS / 2, z)
  group.add(mesh)
}

function buildCorridorPath(group, corridor, roomsById) {
  const roomA = roomsById.get(corridor.roomAId)
  const roomB = roomsById.get(corridor.roomBId)
  const height = Math.min(roomA.size[1], roomB.size[1])
  const points = corridor.points

  for (let i = 0; i < points.length - 1; i += 1) {
    const [x1, z1] = points[i]
    const [x2, z2] = points[i + 1]
    buildCorridorSegment(group, x1, z1, x2, z2, height)
  }
  for (let i = 1; i < points.length - 1; i += 1) {
    buildBendPatch(group, points[i][0], points[i][1])
  }
}

function roomPosition(roomId, offset) {
  const room = ROOM_LAYOUT.find((r) => r.id === roomId)
  return [room.center[0] + offset[0], offset[1], room.center[2] + offset[2]]
}

function addTaskMarkers(group) {
  return TASK_LOCATIONS.map((task) => {
    const [x, y, z] = roomPosition(task.roomId, task.offset)
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), TASK_MATERIAL)
    mesh.position.set(x, y + 0.3, z)
    mesh.userData = { interactable: true, kind: 'task', taskId: task.id }
    group.add(mesh)
    return mesh
  })
}

function addVentMarkers(group) {
  return VENT_LOCATIONS.map((vent) => {
    const [x, y, z] = roomPosition(vent.roomId, vent.offset)
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.2, 8), VENT_MATERIAL)
    mesh.position.set(x, y + 0.1, z)
    mesh.userData = { interactable: true, kind: 'vent', ventId: vent.id }
    group.add(mesh)
    return mesh
  })
}

function addEmergencyButton(group) {
  const [x, y, z] = roomPosition('cafeteria', [0, 0, -3])
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 12), EMERGENCY_BUTTON_MATERIAL)
  mesh.position.set(x, y + 0.4, z)
  mesh.userData = { interactable: true, kind: 'emergencyButton' }
  group.add(mesh)
  return mesh
}

export function buildSkeldMap() {
  const group = new THREE.Group()
  const corridors = computeCorridors(ROOM_LAYOUT, CORRIDOR_WIDTH, CORRIDOR_OVERRIDES)
  const roomsById = new Map(ROOM_LAYOUT.map((room) => [room.id, room]))

  for (const room of ROOM_LAYOUT) {
    buildRoom(group, room, corridors)
  }
  for (const corridor of corridors) {
    buildCorridorPath(group, corridor, roomsById)
  }

  const taskMeshes = addTaskMarkers(group)
  const ventMeshes = addVentMarkers(group)
  const emergencyButton = addEmergencyButton(group)

  const cafeteria = ROOM_LAYOUT.find((room) => room.id === 'cafeteria')
  const spawnPoint = new THREE.Vector3(cafeteria.center[0], 1, cafeteria.center[2])

  return {
    group,
    spawnPoint,
    interactables: [...taskMeshes, ...ventMeshes, emergencyButton],
  }
}
