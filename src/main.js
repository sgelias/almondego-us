import * as THREE from 'three'
import { buildSkeldMap } from './map/skeldMap.js'
import { buildWorldOctree } from './map/worldOctree.js'
import { createPlayerController } from './player/playerController.js'
import { initPointerLockOverlay } from './ui/pointerLockOverlay.js'
import { createInteractSystem } from './interaction/interactSystem.js'

const canvas = document.getElementById('app')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setPixelRatio(window.devicePixelRatio)
renderer.setSize(window.innerWidth, window.innerHeight)

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x111318)

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500)

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x222233, 1.2)
scene.add(hemiLight)

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
dirLight.position.set(20, 30, 10)
scene.add(dirLight)

const { group: mapGroup, spawnPoint, interactables } = buildSkeldMap()
scene.add(mapGroup)

const worldOctree = buildWorldOctree(mapGroup)
const player = createPlayerController(camera, worldOctree, spawnPoint)
const interactSystem = createInteractSystem(camera, interactables)

initPointerLockOverlay(canvas)

document.addEventListener('keydown', (event) => player.handleKeyDown(event))
document.addEventListener('keyup', (event) => player.handleKeyUp(event))
document.addEventListener('mousemove', (event) => player.handleMouseMove(event))

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

const clock = new THREE.Clock()

function animate() {
  requestAnimationFrame(animate)
  const deltaTime = clock.getDelta()
  player.update(deltaTime)
  interactSystem.update()
  renderer.render(scene, camera)
}

animate()
