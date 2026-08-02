import * as THREE from 'three'
import { ROOM_LAYOUT } from './skeldRooms.js'
import { TASK_LOCATIONS } from '../../shared/taskPool.js'
import { VENT_LOCATIONS } from '../../shared/ventPool.js'

const WALL_THICKNESS = 0.3
const CORRIDOR_WIDTH = 4
const FLOOR_THICKNESS = 0.2

const FLOOR_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x445566 })
const WALL_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x8899aa })
const TASK_MATERIAL = new THREE.MeshStandardMaterial({ color: 0xffcc00 })
const VENT_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x333333 })
const EMERGENCY_BUTTON_MATERIAL = new THREE.MeshStandardMaterial({ color: 0xdd2222 })

// Returns where the straight line from `room` to `other` crosses room's own
// boundary: which wall it exits through, and the coordinate along that wall.
// Shared by wall-gap placement and corridor placement so both always agree.
function computeEdge(room, other) {
  const dx = other.center[0] - room.center[0]
  const dz = other.center[2] - room.center[2]
  const distance = Math.hypot(dx, dz)
  const ux = dx / distance
  const uz = dz / distance
  const halfWidth = room.size[0] / 2
  const halfDepth = room.size[2] / 2
  const tx = ux !== 0 ? halfWidth / Math.abs(ux) : Infinity
  const tz = uz !== 0 ? halfDepth / Math.abs(uz) : Infinity
  const t = Math.min(tx, tz)
  const point = [room.center[0] + ux * t, room.center[2] + uz * t]
  const side = tx <= tz ? (ux > 0 ? 'east' : 'west') : uz > 0 ? 'north' : 'south'
  const coord = side === 'north' || side === 'south' ? point[0] : point[1]
  return { side, coord, point }
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

function buildRoom(group, room) {
  const [width, height, depth] = room.size
  const [cx, , cz] = room.center

  addFloorSlab(group, cx, cz, width, depth)

  const gapsBySide = { north: [], south: [], east: [], west: [] }
  for (const connectionId of room.connections) {
    const other = ROOM_LAYOUT.find((r) => r.id === connectionId)
    const { side, coord } = computeEdge(room, other)
    gapsBySide[side].push(coord)
  }

  buildWallWithGaps(group, cz + depth / 2, cx - width / 2, cx + width / 2, height, gapsBySide.north, 'x')
  buildWallWithGaps(group, cz - depth / 2, cx - width / 2, cx + width / 2, height, gapsBySide.south, 'x')
  buildWallWithGaps(group, cx + width / 2, cz - depth / 2, cz + depth / 2, height, gapsBySide.east, 'z')
  buildWallWithGaps(group, cx - width / 2, cz - depth / 2, cz + depth / 2, height, gapsBySide.west, 'z')
}

function buildCorridor(group, roomA, roomB) {
  const dx = roomB.center[0] - roomA.center[0]
  const dz = roomB.center[2] - roomA.center[2]

  const [ax, az] = computeEdge(roomA, roomB).point
  const [bx, bz] = computeEdge(roomB, roomA).point
  const corridorLength = Math.hypot(bx - ax, bz - az)
  const midX = (ax + bx) / 2
  const midZ = (az + bz) / 2
  const height = Math.min(roomA.size[1], roomB.size[1])
  const angle = Math.atan2(-dz, dx)

  const corridorGroup = new THREE.Group()
  corridorGroup.position.set(midX, 0, midZ)
  corridorGroup.rotation.y = angle

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(corridorLength, FLOOR_THICKNESS, CORRIDOR_WIDTH),
    FLOOR_MATERIAL
  )
  floor.position.y = -FLOOR_THICKNESS / 2
  corridorGroup.add(floor)

  const wallGeometry = new THREE.BoxGeometry(corridorLength, height, WALL_THICKNESS)
  const wallA = new THREE.Mesh(wallGeometry, WALL_MATERIAL)
  wallA.position.set(0, height / 2, CORRIDOR_WIDTH / 2)
  corridorGroup.add(wallA)

  const wallB = new THREE.Mesh(wallGeometry.clone(), WALL_MATERIAL)
  wallB.position.set(0, height / 2, -CORRIDOR_WIDTH / 2)
  corridorGroup.add(wallB)

  group.add(corridorGroup)
}

function buildCorridors(group) {
  const built = new Set()
  for (const room of ROOM_LAYOUT) {
    for (const connectionId of room.connections) {
      const pairKey = [room.id, connectionId].sort().join('->')
      if (built.has(pairKey)) continue
      built.add(pairKey)
      const other = ROOM_LAYOUT.find((r) => r.id === connectionId)
      buildCorridor(group, room, other)
    }
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

  for (const room of ROOM_LAYOUT) {
    buildRoom(group, room)
  }
  buildCorridors(group)

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
