import * as THREE from 'three'
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import { createAvatar, disposeAvatar, EYE_TO_FEET } from './playerAvatar.js'

const LERP_RATE = 10

// Name and health live in the SAME CSS2DObject. A second one per player
// would double the cleanup surface that already went wrong once (L-004) and
// every visibility path would have to hide both.
function createLabel(name, color) {
  const div = document.createElement('div')
  div.style.textAlign = 'center'
  div.style.lineHeight = '1.15'

  const nameLine = document.createElement('div')
  nameLine.textContent = name
  div.appendChild(nameLine)

  const healthLine = document.createElement('div')
  healthLine.style.fontSize = '0.8rem'
  healthLine.style.letterSpacing = '0.08em'
  div.appendChild(healthLine)
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
  label.userData.healthLine = healthLine
  return label
}

function renderHealth(healthLine, health, maxHealth) {
  let text = ''
  for (let i = 0; i < maxHealth; i += 1) text += i < health ? '♥' : '♡'
  healthLine.textContent = text
  healthLine.style.color = health <= 1 ? '#ff4d4d' : '#ff9d9d'
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
export function createRemotePlayers(scene, { maxHealth = 3 } = {}) {
  const players = new Map()
  const healthById = new Map()

  function upsert(id, name, colorIndex, position, rotationY, seq) {
    let entry = players.get(id)
    if (!entry) {
      // Tagged as an interactable "player" so an Impostor can target this
      // avatar for a kill via interactSystem's raycast.
      const { group, color } = createAvatar(id, colorIndex, { interactable: true, kind: 'player', killTargetId: id })
      const label = createLabel(name, color)
      renderHealth(label.userData.healthLine, healthById.get(id) ?? maxHealth, maxHealth)
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

  // Health can arrive before a player's first `state` message, so it is
  // stored by id and applied when the avatar appears.
  function setHealth(id, health) {
    healthById.set(id, health)
    const entry = players.get(id)
    if (entry) renderHealth(entry.label.userData.healthLine, health, maxHealth)
  }

  function resetHealth() {
    healthById.clear()
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

  // Applies limited vision. `isVisible(id, position)` comes from the shared
  // line-of-sight rule so the client agrees exactly with what bots can see.
  //
  // Three things have to move together, and missing any one of them breaks
  // the feature in a different way:
  //  - the group's own visibility (the avatar);
  //  - the CSS2D label's DOM element, which is NOT covered by the group's
  //    `visible` flag (same shape as L-004) - otherwise names float over
  //    invisible players, which is worse than no vision limit at all;
  //  - getMeshes(), which feeds interactSystem's raycast - an invisible but
  //    still-raycastable avatar would let an Impostor kill through a wall.
  function applyVisibility(isVisible) {
    for (const [id, entry] of players) {
      const visible = isVisible(id, entry.group.position)
      entry.visible = visible
      entry.group.visible = visible
      entry.label.element.style.display = visible ? '' : 'none'
    }
  }

  function getMeshes() {
    return [...players.values()].filter((entry) => entry.visible !== false).map((entry) => entry.group)
  }

  return { upsert, remove, update, applyVisibility, getMeshes, setHealth, resetHealth }
}
