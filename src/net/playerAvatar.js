import * as THREE from 'three'

// The classic Among Us crewmate palette.
export const CREW_COLORS = [
  0xc51111, 0x132ed1, 0x117f2d, 0xed54ba, 0xef7d0d, 0xf5f557,
  0x3f474e, 0xd6e0f0, 0x6b2fbb, 0x71491e, 0x38fedc, 0x50ef39,
]

// Total avatar height, matching playerController's capsule (segment 1.0 +
// 2 x radius 0.35). The avatar is modelled standing on y=0 so the maths
// stays readable; the caller drops the group to foot level.
const AVATAR_HEIGHT = 1.7
// Distance from the feet up to the camera/eye, i.e. capsule segment height
// plus radius. Network "position" is an eye position (see main.js), so the
// avatar group sits this far below it.
export const EYE_TO_FEET = 1.35

const BODY_RADIUS = 0.34
const BODY_CYLINDER = 0.62
const LEG_HEIGHT = 0.3

const VISOR_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0x9fd4e8,
  roughness: 0.15,
  metalness: 0.1,
  emissive: 0x22506b,
  emissiveIntensity: 0.5,
})

// Geometry is shared across every avatar - only the body material differs
// per player, so all of this is created once at module load.
const bodyGeometry = new THREE.CapsuleGeometry(BODY_RADIUS, BODY_CYLINDER, 6, 16)
const legGeometry = new THREE.BoxGeometry(0.17, LEG_HEIGHT, 0.24)
const backpackGeometry = new THREE.BoxGeometry(0.34, 0.55, 0.22)
const visorGeometry = new THREE.CapsuleGeometry(0.13, 0.22, 4, 12)

const materialsByColor = new Map()

function bodyMaterial(color) {
  let material = materialsByColor.get(color)
  if (!material) {
    material = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05 })
    materialsByColor.set(color, material)
  }
  return material
}

// Colour is assigned by the server (same as unique names) and travels in the
// roster, so every client paints a given player identically and no two
// players share a colour. Deriving it locally from join order would differ
// per client; hashing the id would collide - with 12 colours and 6 players a
// duplicate is more likely than not.
export function colorForIndex(colorIndex) {
  return CREW_COLORS[colorIndex % CREW_COLORS.length]
}

// Fallback only, for the narrow window where a `state` message could arrive
// before the `playerJoined` that carries the colour. Stable per id, so the
// avatar does not flicker if it is ever used.
export function colorForPlayerId(playerId) {
  let hash = 0
  for (let i = 0; i < playerId.length; i += 1) {
    hash = (hash * 31 + playerId.charCodeAt(i)) >>> 0
  }
  return CREW_COLORS[hash % CREW_COLORS.length]
}

// Builds the crewmate silhouette: bean body, side visor, backpack, two
// stubby legs. Forward is -z, matching playerController's yaw convention.
export function createAvatar(playerId, colorIndex, userData) {
  const color = Number.isInteger(colorIndex) ? colorForIndex(colorIndex) : colorForPlayerId(playerId)
  const material = bodyMaterial(color)
  const group = new THREE.Group()

  const body = new THREE.Mesh(bodyGeometry, material)
  body.position.y = LEG_HEIGHT + BODY_CYLINDER / 2 + BODY_RADIUS
  group.add(body)

  const backpack = new THREE.Mesh(backpackGeometry, material)
  backpack.position.set(0, LEG_HEIGHT + 0.55, 0.3)
  group.add(backpack)

  const visor = new THREE.Mesh(visorGeometry, VISOR_MATERIAL)
  visor.position.set(0, AVATAR_HEIGHT - 0.42, -0.24)
  visor.rotation.z = Math.PI / 2
  group.add(visor)

  for (const offsetX of [-0.16, 0.16]) {
    const leg = new THREE.Mesh(legGeometry, material)
    leg.position.set(offsetX, LEG_HEIGHT / 2, 0)
    group.add(leg)
  }

  // Tag every part, not just the group: interactSystem raycasts recursively
  // and reports whichever child mesh was hit, so the kill-target data has to
  // be reachable from any of them.
  for (const part of group.children) part.userData = userData

  return { group, color }
}

export function disposeAvatar(group) {
  // Geometries and materials are shared module-level singletons, so removing
  // the group from the scene is the whole cleanup - disposing them here
  // would break every other avatar.
  group.clear()
}
