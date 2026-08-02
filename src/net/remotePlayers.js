import * as THREE from 'three'
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'

const CAPSULE_RADIUS = 0.35
const CAPSULE_HEIGHT = 1.0
const LERP_RATE = 10

// Network "position" is the sender's camera/eye position (see main.js), which
// sits at the top of their capsule. This mesh's CapsuleGeometry is centered on
// its own origin, so it must be drawn EYE_TO_CENTER_OFFSET below the eye to
// land on the floor instead of floating.
const EYE_TO_CENTER_OFFSET = CAPSULE_HEIGHT / 2

const AVATAR_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x33aaff })

function createLabel(name) {
  const div = document.createElement('div')
  div.textContent = name
  div.style.color = '#fff'
  div.style.fontFamily = 'sans-serif'
  div.style.fontSize = '0.85rem'
  div.style.textShadow = '0 0 3px #000'
  div.style.pointerEvents = 'none'

  const label = new CSS2DObject(div)
  label.position.set(0, CAPSULE_HEIGHT / 2 + CAPSULE_RADIUS + 0.4, 0)
  return label
}

function toMeshPosition(position) {
  return [position[0], position[1] - EYE_TO_CENTER_OFFSET, position[2]]
}

// SPEC_DEVIATION: design.md's signature was createRemotePlayers(scene, labelRenderer).
// CSS2DObject only needs to be added to the scene graph - the CSS2DRenderer that
// draws it doesn't need a reference back, so the unused param was dropped.
export function createRemotePlayers(scene) {
  const players = new Map()

  function upsert(id, name, position, rotationY, seq) {
    let entry = players.get(id)
    if (!entry) {
      const mesh = new THREE.Mesh(
        new THREE.CapsuleGeometry(CAPSULE_RADIUS, CAPSULE_HEIGHT, 4, 8),
        AVATAR_MATERIAL
      )
      const label = createLabel(name)
      mesh.add(label)

      const [x, y, z] = toMeshPosition(position)
      mesh.position.set(x, y, z)
      scene.add(mesh)

      entry = {
        mesh,
        label,
        lastSeq: -1,
        target: new THREE.Vector3(x, y, z),
        targetRotationY: rotationY,
      }
      players.set(id, entry)
    }

    if (seq <= entry.lastSeq) return
    entry.lastSeq = seq
    const [x, y, z] = toMeshPosition(position)
    entry.target.set(x, y, z)
    entry.targetRotationY = rotationY
  }

  function remove(id) {
    const entry = players.get(id)
    if (!entry) return
    entry.mesh.remove(entry.label)
    entry.label.element.remove()
    scene.remove(entry.mesh)
    entry.mesh.geometry.dispose()
    players.delete(id)
  }

  function update(deltaTime) {
    const t = 1 - Math.exp(-LERP_RATE * deltaTime)
    for (const entry of players.values()) {
      entry.mesh.position.lerp(entry.target, t)
      entry.mesh.rotation.y += (entry.targetRotationY - entry.mesh.rotation.y) * t
    }
  }

  return { upsert, remove, update }
}
