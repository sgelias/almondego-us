import * as THREE from 'three'
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js'
import { buildSkeldMap } from './map/skeldMap.js'
import { buildWorldOctree } from './map/worldOctree.js'
import { createPlayerController } from './player/playerController.js'
import { initPointerLockOverlay } from './ui/pointerLockOverlay.js'
import { createInteractSystem } from './interaction/interactSystem.js'
import { showLobby } from './lobby/lobbyScreen.js'
import { createNetClient, CONNECTED, CONNECTION_ERROR } from './net/client.js'
import { createRemotePlayers } from './net/remotePlayers.js'
import { MESSAGE_TYPE } from '../shared/protocol.js'

const DEFAULT_PORT = 8080
const STATE_SEND_INTERVAL = 1 / 15

const canvas = document.getElementById('app')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setPixelRatio(window.devicePixelRatio)
renderer.setSize(window.innerWidth, window.innerHeight)

const labelRenderer = new CSS2DRenderer()
labelRenderer.setSize(window.innerWidth, window.innerHeight)
labelRenderer.domElement.style.position = 'absolute'
labelRenderer.domElement.style.top = '0'
labelRenderer.domElement.style.pointerEvents = 'none'
document.body.appendChild(labelRenderer.domElement)

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

// Corridors are rotated Object3D children; force world matrices to be
// current before the octree reads them, so collision matches what renders.
mapGroup.updateMatrixWorld(true)
const worldOctree = buildWorldOctree(mapGroup)
const player = createPlayerController(camera, worldOctree, spawnPoint)
const interactSystem = createInteractSystem(camera, interactables)
const remotePlayers = createRemotePlayers(scene)

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  labelRenderer.setSize(window.innerWidth, window.innerHeight)
})

const roster = new Map()
let netClient = null
let started = false

function updateLobbyRoster(lobby) {
  lobby.setPlayers([...roster.values()])
}

function connect(url, name, lobby) {
  netClient = createNetClient(url)

  netClient.on(CONNECTED, () => {
    netClient.send(MESSAGE_TYPE.JOIN, { name })
  })

  netClient.on(CONNECTION_ERROR, ({ message }) => {
    lobby.showConnectionError(message)
  })

  netClient.on(MESSAGE_TYPE.WELCOME, (msg) => {
    lobby.setIsHost(msg.isHost)
    roster.clear()
    for (const entry of msg.players) roster.set(entry.id, entry)
    updateLobbyRoster(lobby)
  })

  netClient.on(MESSAGE_TYPE.PLAYER_JOINED, (msg) => {
    roster.set(msg.id, { id: msg.id, name: msg.name })
    updateLobbyRoster(lobby)
  })

  netClient.on(MESSAGE_TYPE.PLAYER_LEFT, (msg) => {
    roster.delete(msg.id)
    updateLobbyRoster(lobby)
    if (started) remotePlayers.remove(msg.id)
  })

  netClient.on(MESSAGE_TYPE.STATE, (msg) => {
    if (!started) return
    const name = roster.get(msg.id)?.name ?? 'Player'
    remotePlayers.upsert(msg.id, name, msg.position, msg.rotationY, msg.seq)
  })

  netClient.on(MESSAGE_TYPE.START, () => {
    startGame(lobby)
  })
}

function startGame(lobby) {
  started = true
  lobby.hide()
  initPointerLockOverlay(canvas)

  document.addEventListener('keydown', (event) => player.handleKeyDown(event))
  document.addEventListener('keyup', (event) => player.handleKeyUp(event))
  document.addEventListener('mousemove', (event) => player.handleMouseMove(event))

  const clock = new THREE.Clock()
  let stateSendAccumulator = 0
  let sendSeq = 0

  function animate() {
    requestAnimationFrame(animate)
    const deltaTime = clock.getDelta()

    player.update(deltaTime)
    interactSystem.update()
    remotePlayers.update(deltaTime)

    stateSendAccumulator += deltaTime
    if (stateSendAccumulator >= STATE_SEND_INTERVAL) {
      stateSendAccumulator = 0
      sendSeq += 1
      netClient.send(MESSAGE_TYPE.STATE, {
        position: [camera.position.x, camera.position.y, camera.position.z],
        rotationY: camera.rotation.y,
        seq: sendSeq,
      })
    }

    renderer.render(scene, camera)
    labelRenderer.render(scene, camera)
  }

  animate()
}

const lobby = showLobby({
  onHostAndJoin(name) {
    connect(`ws://localhost:${DEFAULT_PORT}`, name, lobby)
  },
  onJoin(address, name) {
    connect(`ws://${address}`, name, lobby)
  },
  onStart() {
    netClient.send(MESSAGE_TYPE.START, {})
  },
})
