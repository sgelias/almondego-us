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
import { colorForIndex } from './net/playerAvatar.js'
import { createRoleUI } from './game/roleUI.js'
import { createTaskInteraction } from './game/taskInteraction.js'
import { createMeetingUI } from './game/meetingUI.js'
import { showGameOver } from './game/gameOverScreen.js'
import { createVentTransition } from './ui/ventTransition.js'
import { MESSAGE_TYPE } from '../shared/protocol.js'
import { TASK_LOCATIONS } from '../shared/taskPool.js'

const DEFAULT_PORT = 8080
const STATE_SEND_INTERVAL = 1 / 15
const MEETING_RESULT_DISPLAY_MS = 4000

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
scene.background = new THREE.Color(0x0a0d12)
// Now that rooms have ceilings, sightlines down long corridors are the main
// depth cue. A little fog makes distance readable and hides the far end of
// the map without a hard clip.
scene.fog = new THREE.Fog(0x0a0d12, 18, 60)

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500)

const hemiLight = new THREE.HemisphereLight(0xb8cfe6, 0x2a2f3a, 1.1)
scene.add(hemiLight)

// No shadow maps and no per-room lights: every MeshStandardMaterial fragment
// evaluates every light in the scene, so a light per room would be paid for
// on every visible surface. The lit look comes from emissive ceiling strips
// in skeldMap.js instead, which cost nothing per fragment.
const dirLight = new THREE.DirectionalLight(0xffffff, 0.55)
dirLight.position.set(20, 30, 10)
scene.add(dirLight)

const { group: mapGroup, collisionGroup, spawnPoint, interactables: staticInteractables } = buildSkeldMap()
scene.add(mapGroup)

// Force world matrices current before the octree reads them, so collision
// matches what renders.
mapGroup.updateMatrixWorld(true)
const worldOctree = buildWorldOctree(collisionGroup)
const player = createPlayerController(camera, worldOctree, spawnPoint)
const remotePlayers = createRemotePlayers(scene)

// GAME-04/GAME-13: a task prompt only makes sense for a Crewmate looking at
// one of their own, still-incomplete tasks; a vent/kill prompt only for the
// Impostor. assignedTaskIds/completedTaskIds are populated by the ROLE and
// task-completion handlers below.
const assignedTaskIds = new Set()
const completedTaskIds = new Set()

function getPromptText(target) {
  const { kind } = target.userData
  if (kind === 'task') {
    if (localRole !== 'crewmate') return null
    if (!assignedTaskIds.has(target.userData.taskId)) return null
    if (completedTaskIds.has(target.userData.taskId)) return null
    return 'Segure E para fazer a tarefa'
  }
  if (kind === 'vent') {
    return localRole === 'impostor' ? 'Pressione E para usar o duto' : null
  }
  if (kind === 'emergencyButton') {
    return 'Pressione E para chamar reunião'
  }
  if (kind === 'player') {
    return localRole === 'impostor' ? 'Pressione E para matar' : null
  }
  return null
}

// Remote player avatars come and go as players join/die, so the raycast
// target list is read fresh each frame rather than captured once.
const interactSystem = createInteractSystem(
  camera,
  () => [...staticInteractables, ...remotePlayers.getMeshes()],
  getPromptText
)

const roleUI = createRoleUI()
const ventTransition = createVentTransition()

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  labelRenderer.setSize(window.innerWidth, window.innerHeight)
})

const roster = new Map()
let netClient = null
let started = false
let gameEnded = false
let localPlayerId = null
let localRole = null
let localAlive = true
// Suppresses task-hold interaction while a meeting is up or the game has
// ended - the player may be frozen mid-task with E still held down, and
// taskInteraction.update() runs every frame regardless of freeze state.
let interactionsPaused = false
let taskInteraction = null
let interactKeyDown = false

const meetingUI = createMeetingUI({
  onVote(targetId) {
    netClient.send(MESSAGE_TYPE.VOTE, { targetId })
  },
})

function updateLobbyRoster(lobby) {
  lobby.setPlayers([...roster.values()])
}

function showDeathNotice() {
  const notice = document.createElement('div')
  notice.textContent = 'Você morreu. Você ainda pode olhar ao redor, mas ninguém consegue te ver.'
  notice.style.position = 'fixed'
  notice.style.top = '1rem'
  notice.style.left = '50%'
  notice.style.transform = 'translateX(-50%)'
  notice.style.color = '#ff6b6b'
  notice.style.fontFamily = 'sans-serif'
  notice.style.background = 'rgba(0, 0, 0, 0.6)'
  notice.style.padding = '0.5rem 1rem'
  notice.style.borderRadius = '6px'
  document.body.appendChild(notice)
}

function handleInteractPress() {
  if (!started || gameEnded || !netClient || !localAlive) return
  const target = interactSystem.getTarget()
  if (!target) return

  const { kind } = target.userData
  if (kind === 'vent' && localRole === 'impostor') {
    netClient.send(MESSAGE_TYPE.VENT, { ventId: target.userData.ventId })
  } else if (kind === 'emergencyButton') {
    netClient.send(MESSAGE_TYPE.CALL_MEETING, {})
  } else if (kind === 'player' && localRole === 'impostor') {
    netClient.send(MESSAGE_TYPE.KILL, { targetId: target.userData.killTargetId })
  }
}

document.addEventListener('keydown', (event) => {
  if (event.code !== 'KeyE') return
  if (!event.repeat) handleInteractPress()
  interactKeyDown = true
})
document.addEventListener('keyup', (event) => {
  if (event.code === 'KeyE') interactKeyDown = false
})

function connect(url, name, lobby) {
  if (netClient) return
  netClient = createNetClient(url)

  netClient.on(CONNECTED, () => {
    netClient.send(MESSAGE_TYPE.JOIN, { name })
  })

  netClient.on(CONNECTION_ERROR, ({ message }) => {
    lobby.showConnectionError(message)
  })

  // The server is the single authority on whether a match can start (it is
  // the side that knows the bot-filling rules), so surface its rejection
  // rather than second-guessing it here.
  netClient.on(MESSAGE_TYPE.ERROR, (msg) => {
    lobby.showConnectionError(msg.message)
  })

  netClient.on(MESSAGE_TYPE.WELCOME, (msg) => {
    localPlayerId = msg.playerId
    lobby.setIsHost(msg.isHost)
    roster.clear()
    for (const entry of msg.players) roster.set(entry.id, entry)
    updateLobbyRoster(lobby)
  })

  netClient.on(MESSAGE_TYPE.PLAYER_JOINED, (msg) => {
    roster.set(msg.id, { id: msg.id, name: msg.name, colorIndex: msg.colorIndex })
    updateLobbyRoster(lobby)
  })

  netClient.on(MESSAGE_TYPE.PLAYER_LEFT, (msg) => {
    roster.delete(msg.id)
    updateLobbyRoster(lobby)
    if (started) remotePlayers.remove(msg.id)
  })

  netClient.on(MESSAGE_TYPE.STATE, (msg) => {
    if (!started) return
    const entry = roster.get(msg.id)
    remotePlayers.upsert(msg.id, entry?.name ?? 'Jogador', entry?.colorIndex, msg.position, msg.rotationY, msg.seq)
  })

  netClient.on(MESSAGE_TYPE.ROLE, (msg) => {
    localRole = msg.role
    assignedTaskIds.clear()
    for (const taskId of msg.taskIds) assignedTaskIds.add(taskId)
    completedTaskIds.clear()

    const taskLabelsById = {}
    for (const taskId of msg.taskIds) {
      taskLabelsById[taskId] = TASK_LOCATIONS.find((task) => task.id === taskId)?.label ?? taskId
    }
    const myColorIndex = roster.get(localPlayerId)?.colorIndex
    roleUI.showRole(msg.role, taskLabelsById, Number.isInteger(myColorIndex) ? colorForIndex(myColorIndex) : null)

    taskInteraction = createTaskInteraction(interactSystem, msg.taskIds, (taskId) => {
      completedTaskIds.add(taskId)
      roleUI.markTaskDone(taskId)
      netClient.send(MESSAGE_TYPE.TASK_COMPLETE, { taskId })
    })
  })

  netClient.on(MESSAGE_TYPE.TASKS_PROGRESS, (msg) => {
    roleUI.updateProgress(msg.completed, msg.total)
  })

  netClient.on(MESSAGE_TYPE.PLAYER_DIED, (msg) => {
    remotePlayers.remove(msg.id)
    if (msg.id === localPlayerId) {
      localAlive = false
      showDeathNotice()
    }
  })

  netClient.on(MESSAGE_TYPE.MEETING_STARTED, (msg) => {
    player.setFrozen(true)
    interactionsPaused = true
    // Pointer lock captures the mouse for camera look, so the vote buttons
    // below would never receive a click while locked - release it here; the
    // pointer-lock overlay's own "click to resume" flow handles regaining it
    // once the meeting ends (browsers require a user gesture to re-lock).
    document.exitPointerLock()
    meetingUI.showDiscussion(msg.discussionSeconds)
    setTimeout(() => {
      // localAlive is read here, not when the meeting started, so a player
      // killed during the discussion phase still loses the vote.
      if (!gameEnded) meetingUI.showVoting(msg.livingPlayers, msg.votingSeconds, localAlive)
    }, msg.discussionSeconds * 1000)
  })

  netClient.on(MESSAGE_TYPE.MEETING_RESULT, (msg) => {
    if (msg.ejectedId) {
      remotePlayers.remove(msg.ejectedId)
      if (msg.ejectedId === localPlayerId) {
        localAlive = false
        showDeathNotice()
      }
    }
    const ejectedName = msg.ejectedId ? (roster.get(msg.ejectedId)?.name ?? 'Someone') : null
    meetingUI.showResult(ejectedName, msg.wasImpostor)
    setTimeout(() => {
      if (!gameEnded) {
        meetingUI.hide()
        player.setFrozen(false)
        interactionsPaused = false
      }
    }, MEETING_RESULT_DISPLAY_MS)
  })

  netClient.on(MESSAGE_TYPE.GAME_OVER, (msg) => {
    gameEnded = true
    interactionsPaused = true
    player.setFrozen(true)
    document.exitPointerLock()
    meetingUI.hide()
    const impostorName =
      roster.get(msg.impostorId)?.name ?? (msg.impostorId === localPlayerId ? 'you' : 'Unknown')
    showGameOver(msg.winner, impostorName)
  })

  netClient.on(MESSAGE_TYPE.TELEPORT, (msg) => {
    // The move happens at the midpoint, while the screen is black, so the
    // player never sees the world snap - they see themselves go into a duct
    // and come out somewhere else.
    ventTransition.play(() => player.teleportTo(msg.position))
  })

  netClient.on(MESSAGE_TYPE.START, () => {
    startGame(lobby)
  })
}

function startGame(lobby) {
  if (started) return
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
    if (taskInteraction && localAlive && !interactionsPaused) {
      taskInteraction.update(deltaTime, interactKeyDown)
    }

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
