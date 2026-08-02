import * as THREE from 'three'
import { ROOM_LAYOUT } from './skeldRooms.js'

const WALL_THICKNESS = 0.3
const CORRIDOR_WIDTH = 4
const FLOOR_THICKNESS = 0.2

const FLOOR_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x445566 })
const WALL_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x8899aa })
const INTERACTABLE_MATERIAL = new THREE.MeshStandardMaterial({ color: 0xffcc00 })

function directionToSide(fromCenter, toCenter) {
  const dx = toCenter[0] - fromCenter[0]
  const dz = toCenter[2] - fromCenter[2]
  if (Math.abs(dx) >= Math.abs(dz)) {
    return dx > 0 ? 'east' : 'west'
  }
  return dz > 0 ? 'north' : 'south'
}

function boxEdgePoint(room, ux, uz) {
  const halfWidth = room.size[0] / 2
  const halfDepth = room.size[2] / 2
  const tx = ux !== 0 ? halfWidth / Math.abs(ux) : Infinity
  const tz = uz !== 0 ? halfDepth / Math.abs(uz) : Infinity
  const t = Math.min(tx, tz)
  return [room.center[0] + ux * t, room.center[2] + uz * t]
}

function addFloorSlab(group, centerX, centerZ, width, depth) {
  const geometry = new THREE.BoxGeometry(width, FLOOR_THICKNESS, depth)
  const mesh = new THREE.Mesh(geometry, FLOOR_MATERIAL)
  mesh.position.set(centerX, -FLOOR_THICKNESS / 2, centerZ)
  group.add(mesh)
}

function buildRoom(group, room) {
  const [width, height, depth] = room.size
  const [cx, , cz] = room.center

  addFloorSlab(group, cx, cz, width, depth)

  const openSides = new Set(
    room.connections.map((id) => {
      const other = ROOM_LAYOUT.find((r) => r.id === id)
      return directionToSide(room.center, other.center)
    })
  )

  if (!openSides.has('north')) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(width, height, WALL_THICKNESS), WALL_MATERIAL)
    wall.position.set(cx, height / 2, cz + depth / 2)
    group.add(wall)
  }
  if (!openSides.has('south')) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(width, height, WALL_THICKNESS), WALL_MATERIAL)
    wall.position.set(cx, height / 2, cz - depth / 2)
    group.add(wall)
  }
  if (!openSides.has('east')) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(WALL_THICKNESS, height, depth), WALL_MATERIAL)
    wall.position.set(cx + width / 2, height / 2, cz)
    group.add(wall)
  }
  if (!openSides.has('west')) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(WALL_THICKNESS, height, depth), WALL_MATERIAL)
    wall.position.set(cx - width / 2, height / 2, cz)
    group.add(wall)
  }
}

function buildCorridor(group, roomA, roomB) {
  const dx = roomB.center[0] - roomA.center[0]
  const dz = roomB.center[2] - roomA.center[2]
  const distance = Math.hypot(dx, dz)
  const ux = dx / distance
  const uz = dz / distance

  const [ax, az] = boxEdgePoint(roomA, ux, uz)
  const [bx, bz] = boxEdgePoint(roomB, -ux, -uz)
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

function addPlaceholderInteractable(group) {
  const cafeteria = ROOM_LAYOUT.find((room) => room.id === 'cafeteria')
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), INTERACTABLE_MATERIAL)
  mesh.position.set(cafeteria.center[0] + 2, 0.3, cafeteria.center[2] + 2)
  mesh.userData.interactable = true
  group.add(mesh)
  return mesh
}

export function buildSkeldMap() {
  const group = new THREE.Group()

  for (const room of ROOM_LAYOUT) {
    buildRoom(group, room)
  }
  buildCorridors(group)

  const interactable = addPlaceholderInteractable(group)
  const cafeteria = ROOM_LAYOUT.find((room) => room.id === 'cafeteria')
  const spawnPoint = new THREE.Vector3(cafeteria.center[0], 1, cafeteria.center[2])

  return { group, spawnPoint, interactables: [interactable] }
}
