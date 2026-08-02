import * as THREE from 'three'
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import { COLORS } from '../ui/theme.js'

// Finding your tasks was the hard part of the game, and not in a good way:
// five consoles are scattered over fourteen rooms, only three are yours, and
// limited vision means you cannot see past the room you are standing in. The
// HUD named the room but the player still had to know where that room was.
//
// This draws, for every assigned and still-incomplete task:
//  - a floating arrow above the console, rendered THROUGH walls, so you can
//    see where to go from anywhere;
//  - the room name and live distance under it;
//  - an arrow pinned to the edge of the screen when the task is behind you
//    or off to the side, so you know which way to turn.

const BOB_HEIGHT = 0.35
const BOB_SPEED = 2.2
const ARROW_BASE_Y = 2.6
const EDGE_MARGIN = 64

// depthTest:false plus a high renderOrder is what makes the marker visible
// through geometry - without it the arrow is hidden by the very walls the
// player needs guiding around.
function guideMaterial(color) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.95,
    depthTest: false,
    depthWrite: false,
  })
}

const ARROW_GEOMETRY = new THREE.ConeGeometry(0.32, 0.7, 4)
const RING_GEOMETRY = new THREE.TorusGeometry(0.55, 0.07, 6, 18)

function createLabel() {
  const div = document.createElement('div')
  div.style.color = COLORS.accent
  div.style.fontFamily = 'system-ui, -apple-system, "Segoe UI", sans-serif'
  div.style.fontSize = '0.8rem'
  div.style.fontWeight = '700'
  div.style.textShadow = '0 0 5px #000, 0 0 2px #000'
  div.style.whiteSpace = 'nowrap'
  div.style.pointerEvents = 'none'
  const label = new CSS2DObject(div)
  label.position.set(0, 0.85, 0)
  return label
}

function createEdgeArrow() {
  const el = document.createElement('div')
  el.style.position = 'fixed'
  el.style.left = '0'
  el.style.top = '0'
  el.style.display = 'none'
  el.style.pointerEvents = 'none'
  el.style.zIndex = '12'
  el.style.fontSize = '1.6rem'
  el.style.lineHeight = '1'
  el.style.color = COLORS.accent
  el.style.textShadow = '0 0 6px #000'
  el.textContent = '➤'
  document.body.appendChild(el)
  return el
}

export function createTaskGuide(scene, camera) {
  const entries = new Map()
  const projected = new THREE.Vector3()

  function clear() {
    for (const entry of entries.values()) {
      // The CSS2DObject's element is not cleaned up by removing an ancestor
      // (see STATE.md L-004) - it has to be detached itself.
      entry.group.remove(entry.label)
      entry.label.element.remove()
      scene.remove(entry.group)
      entry.edge.remove()
    }
    entries.clear()
  }

  function setTargets(targets) {
    clear()
    for (const target of targets) {
      const group = new THREE.Group()
      group.position.set(target.position[0], 0, target.position[2])

      const arrow = new THREE.Mesh(ARROW_GEOMETRY, guideMaterial(0xffd34d))
      arrow.rotation.x = Math.PI // point down at the console
      arrow.renderOrder = 999
      group.add(arrow)

      const ring = new THREE.Mesh(RING_GEOMETRY, guideMaterial(0x8fd3ff))
      ring.rotation.x = Math.PI / 2
      ring.position.y = -0.55
      ring.renderOrder = 999
      group.add(ring)

      const label = createLabel()
      group.add(label)

      scene.add(group)
      entries.set(target.taskId, {
        group,
        arrow,
        label,
        edge: createEdgeArrow(),
        roomName: target.roomName,
      })
    }
  }

  function remove(taskId) {
    const entry = entries.get(taskId)
    if (!entry) return
    entry.group.remove(entry.label)
    entry.label.element.remove()
    scene.remove(entry.group)
    entry.edge.remove()
    entries.delete(taskId)
  }

  function update(elapsed) {
    const width = window.innerWidth
    const height = window.innerHeight
    const centerX = width / 2
    const centerY = height / 2

    for (const entry of entries.values()) {
      const bob = Math.sin(elapsed * BOB_SPEED) * BOB_HEIGHT
      entry.group.position.y = ARROW_BASE_Y + bob
      entry.arrow.rotation.y += 0.03

      const distance = camera.position.distanceTo(entry.group.position)
      entry.label.element.textContent = `${entry.roomName} · ${Math.round(distance)} m`

      projected.copy(entry.group.position).project(camera)
      // z > 1 means the point is behind the camera; its projected x/y are
      // mirrored, so they have to be flipped before being used as a direction.
      const behind = projected.z > 1
      let screenX = (projected.x * (behind ? -1 : 1) * 0.5 + 0.5) * width
      let screenY = (-projected.y * (behind ? -1 : 1) * 0.5 + 0.5) * height

      const onScreen =
        !behind && screenX > EDGE_MARGIN && screenX < width - EDGE_MARGIN && screenY > EDGE_MARGIN && screenY < height - EDGE_MARGIN

      if (onScreen) {
        entry.edge.style.display = 'none'
        continue
      }

      // Off-screen: pin an arrow to the edge, pointing the way to turn.
      const dx = screenX - centerX
      const dy = screenY - centerY
      const angle = Math.atan2(dy, dx)
      const maxX = centerX - EDGE_MARGIN
      const maxY = centerY - EDGE_MARGIN
      const scale = Math.min(Math.abs(maxX / (dx || 0.0001)), Math.abs(maxY / (dy || 0.0001)))

      entry.edge.style.display = 'block'
      entry.edge.style.transform =
        `translate(${centerX + dx * scale - 12}px, ${centerY + dy * scale - 12}px) rotate(${angle}rad)`
    }
  }

  return { setTargets, remove, update, clear }
}
