import * as THREE from 'three'

const INTERACT_RANGE = 3
const SCREEN_CENTER = new THREE.Vector2(0, 0)

export function createInteractSystem(camera, interactables) {
  const raycaster = new THREE.Raycaster()
  raycaster.far = INTERACT_RANGE

  const prompt = document.createElement('div')
  prompt.textContent = 'Press E to interact'
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
      const hits = raycaster.intersectObjects(interactables, false)
      currentTarget = hits.length > 0 ? hits[0].object : null
      prompt.style.display = currentTarget ? 'block' : 'none'
    },

    getTarget() {
      return currentTarget
    },
  }
}
