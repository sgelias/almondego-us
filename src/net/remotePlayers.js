import * as THREE from 'three'
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import { createAvatar, disposeAvatar, EYE_TO_FEET } from './playerAvatar.js'

const LERP_RATE = 10

function createLabel(name, color) {
  const div = document.createElement('div')
  div.textContent = name
  // Matching the avatar's body colour makes "who is that" readable at a
  // glance without having to get close enough to see the model.
  div.style.color = `#${color.toString(16).padStart(6, '0')}`
  div.style.fontFamily = 'sans-serif'
  div.style.fontSize = '0.85rem'
  div.style.fontWeight = '600'
  div.style.textShadow = '0 0 4px #000, 0 0 2px #000'
  div.style.pointerEvents = 'none'

  const label = new CSS2DObject(div)
  label.position.set(0, 2.1, 0)
  return label
}

// Network "position" is the sender's camera/eye position (see main.js). The
// avatar is modelled standing on its own origin, so the group is dropped
// EYE_TO_FEET below the reported eye to put its feet on the floor.
function toFeetPosition(position) {
  return [position[0], position[1] - EYE_TO_FEET, position[2]]
}

// SPEC_DEVIATION: design.md's signature was createRemotePlayers(scene, labelRenderer).
// CSS2DObject only needs to be added to the scene graph - the CSS2DRenderer that
// draws it doesn't need a reference back, so the unused param was dropped.
export function createRemotePlayers(scene) {
  const players = new Map()

  function upsert(id, name, colorIndex, position, rotationY, seq) {
    let entry = players.get(id)
    if (!entry) {
      // Tagged as an interactable "player" so an Impostor can target this
      // avatar for a kill via interactSystem's raycast.
      const { group, color } = createAvatar(id, colorIndex, { interactable: true, kind: 'player', killTargetId: id })
      const label = createLabel(name, color)
      group.add(label)

      const [x, y, z] = toFeetPosition(position)
      group.position.set(x, y, z)
      scene.add(group)

      entry = {
        group,
        label,
        lastSeq: -1,
        target: new THREE.Vector3(x, y, z),
        targetRotationY: rotationY,
      }
      players.set(id, entry)
    }

    if (seq <= entry.lastSeq) return
    entry.lastSeq = seq
    const [x, y, z] = toFeetPosition(position)
    entry.target.set(x, y, z)
    entry.targetRotationY = rotationY
  }

  function remove(id) {
    const entry = players.get(id)
    if (!entry) return
    // A CSS2DObject only cleans up its DOM element on its own 'removed'
    // event, which removing an ancestor does not fire - it has to be
    // detached directly (see STATE.md L-004).
    entry.group.remove(entry.label)
    entry.label.element.remove()
    scene.remove(entry.group)
    disposeAvatar(entry.group)
    players.delete(id)
  }

  function update(deltaTime) {
    const t = 1 - Math.exp(-LERP_RATE * deltaTime)
    for (const entry of players.values()) {
      entry.group.position.lerp(entry.target, t)
      entry.group.rotation.y += (entry.targetRotationY - entry.group.rotation.y) * t
    }
  }

  function getMeshes() {
    return [...players.values()].map((entry) => entry.group)
  }

  return { upsert, remove, update, getMeshes }
}
