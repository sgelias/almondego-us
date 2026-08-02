import * as THREE from 'three'

const INTERACT_RANGE = 3
const SCREEN_CENTER = new THREE.Vector2(0, 0)

// SPEC_DEVIATION: design.md's original signature took a fixed `interactables`
// array. Milestone 3 needs to raycast against remote-player meshes too, which
// are added/removed as players join/die - a snapshot array can't reflect
// that, so this now takes a callback returning the current list each frame.
//
// getPromptText(target) is optional: given the current raycast hit, return
// the prompt string to show, or a falsy value to show nothing. Without it,
// every hit shows a generic "Press E to interact" - GAME-04/GAME-13 require
// role- and assignment-aware suppression (e.g. no prompt for a Crewmate
// looking at a vent), which only the caller (main.js) has enough context to
// decide.
export function createInteractSystem(camera, getInteractables, getPromptText) {
  const raycaster = new THREE.Raycaster()
  raycaster.far = INTERACT_RANGE

  const prompt = document.createElement('div')
  prompt.style.position = 'fixed'
  prompt.style.left = '50%'
  prompt.style.top = '55%'
  prompt.style.transform = 'translate(-50%, -50%)'
  prompt.style.color = '#fff'
  prompt.style.fontFamily = 'sans-serif'
  prompt.style.fontSize = '1.2rem'
  prompt.style.textShadow = '0 0 4px #000'
  prompt.style.display = 'none'
  document.body.appendChild(prompt)

  let currentTarget = null

  return {
    update() {
      raycaster.setFromCamera(SCREEN_CENTER, camera)
      const hits = raycaster.intersectObjects(getInteractables(), false)
      currentTarget = hits.length > 0 ? hits[0].object : null

      const text = currentTarget
        ? getPromptText
          ? getPromptText(currentTarget)
          : 'Pressione E para interagir'
        : null
      prompt.textContent = text ?? ''
      prompt.style.display = text ? 'block' : 'none'
    },

    getTarget() {
      return currentTarget
    },
  }
}
