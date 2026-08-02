import * as THREE from 'three'
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'

const CAPSULE_RADIUS = 0.35
const CAPSULE_HEIGHT = 1.0
const LERP_RATE = 10

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
      mesh.add(createLabel(name))
      mesh.position.set(position[0], position[1], position[2])
      scene.add(mesh)
      entry = {
        mesh,
        lastSeq: -1,
        target: new THREE.Vector3(position[0], position[1], position[2]),
        targetRotationY: rotationY,
      }
      players.set(id, entry)
    }

    if (seq <= entry.lastSeq) return
    entry.lastSeq = seq
    entry.target.set(position[0], position[1], position[2])
    entry.targetRotationY = rotationY
  }

  function remove(id) {
    const entry = players.get(id)
    if (!entry) return
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
