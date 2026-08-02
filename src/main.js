import * as THREE from 'three'
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js'
import { buildSkeldMap } from './map/skeldMap.js'
import { createNavGraph } from '../shared/navGraph.js'
import { ROOM_LAYOUT } from '../shared/skeldRooms.js'
import { SKELD_CORRIDORS } from '../shared/skeldCorridors.js'
import { buildWorldOctree } from './map/worldOctree.js'
import { createPlayerController } from './player/playerController.js'
import { initPointerLockOverlay } from './ui/pointerLockOverlay.js'
import { createInteractSystem } from './interaction/interactSystem.js'
import { showLobby } from './lobby/lobbyScreen.js'
import { createNetClient, CONNECTED, CONNECTION_ERROR } from './net/client.js'
import { createRemotePlayers } from './net/remotePlayers.js'
import { colorForIndex } from './net/playerAvatar.js'
import { createRoleUI } from './game/roleUI.js'
import { createTaskQuiz, WRONG_ANSWER_LOCKOUT_MS } from './game/taskQuiz.js'
import { drawTaskQuestion, drawResearchQuestion } from '../shared/questionBank.js'
import { createMeetingUI } from './game/meetingUI.js'
import { showGameOver } from './game/gameOverScreen.js'
import { createVentTransition } from './ui/ventTransition.js'
import { createSfx } from './audio/sfx.js'
import { MESSAGE_TYPE } from '../shared/protocol.js'
import { TASK_LOCATIONS } from '../shared/taskPool.js'

const DEFAULT_PORT = 8080
const STATE_SEND_INTERVAL = 1 / 15
const MEETING_RESULT_DISPLAY_MS = 4000
// Must match botRunner's SENSE_RADIUS: bots and humans standing in the same
// place have to see the same set of people, or one side is playing with an
// advantage.
const VISION_RADIUS = 9

// NOTE (trust model): this hides other players from *rendering*, it does not
// withhold their positions. The server still broadcasts every living
// player's state to everyone, so a determined player with devtools open can
// still read them. That is consistent with AD-002's LAN-trusted, no-anti-
// cheat scope - stated here so "limited vision" is not mistaken for a
// security property.
const navGraph = createNavGraph(ROOM_LAYOUT, SKELD_CORRIDORS)

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
const sfx = createSfx()
const player = createPlayerController(camera, worldOctree, spawnPoint, { onStep: () => sfx.footstep() })
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
    if (taskLockoutUntil.get(target.userData.taskId) > Date.now()) return 'Console reiniciando…'
    return 'Pressione E para fazer a tarefa'
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
// Suppresses task interaction while a meeting is up or the game has ended.
let interactionsPaused = false
// taskId -> timestamp before which that console refuses to reopen, the cost
// of a wrong answer (AD-008).
const taskLockoutUntil = new Map()
const taskQuiz = createTaskQuiz()

const meetingUI = createMeetingUI({
  onVote(targetId) {
    sfx.vote()
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

// Opens the educational minigame for a task console. The player is frozen
// and pointer lock is released while it is up - they are standing still at a
// console, which is exactly when an Impostor can reach them, and the mouse
// has to be free to click the answers (the same pointer-lock problem the
// voting UI hit, see STATE.md L-008).
function openTaskQuiz(taskId) {
  if (localRole !== 'crewmate') return
  if (!assignedTaskIds.has(taskId) || completedTaskIds.has(taskId)) return
  if ((taskLockoutUntil.get(taskId) ?? 0) > Date.now()) return
  if (taskQuiz.isOpen()) return

  player.setFrozen(true)
  document.exitPointerLock()

  taskQuiz.show(drawTaskQuestion(Math.random), (result) => {
    if (!gameEnded && !interactionsPaused) player.setFrozen(false)

    if (result === 'correct') {
      completedTaskIds.add(taskId)
      sfx.taskDone()
      roleUI.markTaskDone(taskId)
      netClient.send(MESSAGE_TYPE.TASK_COMPLETE, { taskId })
    } else if (result === 'wrong') {
      // The cost of a wrong answer: this console is unusable for a few
      // seconds and will ask a different question next time.
      taskLockoutUntil.set(taskId, Date.now() + WRONG_ANSWER_LOCKOUT_MS)
    }
  })
}

function handleInteractPress() {
  if (!started || gameEnded || !netClient || !localAlive) return
  if (interactionsPaused || taskQuiz.isOpen()) return
  const target = interactSystem.getTarget()
  if (!target) return

  const { kind } = target.userData
  if (kind === 'task') {
    openTaskQuiz(target.userData.taskId)
  } else if (kind === 'vent' && localRole === 'impostor') {
    netClient.send(MESSAGE_TYPE.VENT, { ventId: target.userData.ventId })
  } else if (kind === 'emergencyButton') {
    netClient.send(MESSAGE_TYPE.CALL_MEETING, {})
  } else if (kind === 'player' && localRole === 'impostor') {
    netClient.send(MESSAGE_TYPE.KILL, { targetId: target.userData.killTargetId })
  }
}

document.addEventListener('keydown', (event) => {
  if (event.code === 'Escape') {
    taskQuiz.cancel()
    return
  }
  if (event.code !== 'KeyE') return
  if (!event.repeat) handleInteractPress()
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

    taskLockoutUntil.clear()
  })

  netClient.on(MESSAGE_TYPE.TASKS_PROGRESS, (msg) => {
    roleUI.updateProgress(msg.completed, msg.total)
  })

  netClient.on(MESSAGE_TYPE.PLAYER_DIED, (msg) => {
    remotePlayers.remove(msg.id)
    if (msg.id === localPlayerId) {
      localAlive = false
      sfx.death()
      showDeathNotice()
    } else {
      sfx.kill()
    }
  })

  netClient.on(MESSAGE_TYPE.MEETING_STARTED, (msg) => {
    player.setFrozen(true)
    interactionsPaused = true
    taskQuiz.cancel()
    // Pointer lock captures the mouse for camera look, so the vote buttons
    // below would never receive a click while locked - release it here; the
    // pointer-lock overlay's own "click to resume" flow handles regaining it
    // once the meeting ends (browsers require a user gesture to re-lock).
    document.exitPointerLock()
    sfx.meeting()
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
    if (msg.ejectedId) sfx.eject()
    const ejectedName = msg.ejectedId ? (roster.get(msg.ejectedId)?.name ?? 'Alguém') : null
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
    const iWon = (msg.winner === 'crew') === (localRole !== 'impostor')
    if (iWon) sfx.win()
    else sfx.lose()
    const impostorName =
      roster.get(msg.impostorId)?.name ?? (msg.impostorId === localPlayerId ? 'você' : 'Desconhecido')
    showGameOver(msg.winner, impostorName)
  })

  netClient.on(MESSAGE_TYPE.TELEPORT, (msg) => {
    // The move happens at the midpoint, while the screen is black, so the
    // player never sees the world snap - they see themselves go into a duct
    // and come out somewhere else.
    sfx.vent()
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
  const pointerLock = initPointerLockOverlay(canvas)
  // Browsers only allow audio to start from a user gesture; the overlay's
  // click is one that already exists in the flow.
  pointerLock.onActivate(() => {
    sfx.resume()
    sfx.startAmbient()
  })

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
    remotePlayers.update(deltaTime)
    // Visibility must be resolved before interactSystem raycasts, so a
    // player you cannot see is also not a valid kill target.
    remotePlayers.applyVisibility((id, position) =>
      navGraph.canSee(camera.position.x, camera.position.z, position.x, position.z, VISION_RADIUS)
    )
    interactSystem.update()

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

// A research challenge to work on while waiting for the match to fill.
lobby.showResearchChallenge(drawResearchQuestion(Math.random))
