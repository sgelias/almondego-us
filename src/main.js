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
import { createHealthUI } from './game/healthUI.js'
import { createSpellUI } from './game/spellUI.js'
import { createTaskGuide } from './game/taskGuide.js'
import { createCarryUI } from './game/carryUI.js'
import { createEventUI } from './game/eventUI.js'
import { getEventById, panelPosition } from '../shared/eventPool.js'
import { ROOM_LABELS } from './ui/minimap.js'
import { getSpellById } from '../shared/spellPool.js'
import { createTaskQuiz, WRONG_ANSWER_LOCKOUT_MS } from './game/taskQuiz.js'
import { drawTaskQuestion, drawResearchQuestion } from '../shared/questionBank.js'
import { getTaskById, stepPosition } from '../shared/taskPool.js'
import { createMeetingUI } from './game/meetingUI.js'
import { showGameOver } from './game/gameOverScreen.js'
import { createVentTransition } from './ui/ventTransition.js'
import { createSfx } from './audio/sfx.js'
import { createMinimap } from './ui/minimap.js'
import { createToast } from './ui/toast.js'
import { CORRIDOR_WIDTH } from '../shared/skeldCorridors.js'
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

// Audio unlock. The pointer-lock overlay's click was the only trigger before
// and the user reported no sound at all, so this no longer depends on one
// specific element being the thing that gets clicked: any first gesture
// anywhere unlocks audio. Capture phase, so it fires even if something above
// stops propagation, and { once: false } because the very first gesture may
// land while the AudioContext is still being created.
function unlockAudio() {
  sfx.resume()
  if (sfx.isRunning()) {
    sfx.confirmUnlock()
    sfx.startAmbient()
    document.removeEventListener('pointerdown', unlockAudio, true)
    document.removeEventListener('keydown', unlockAudio, true)
  }
}
document.addEventListener('pointerdown', unlockAudio, true)
document.addEventListener('keydown', unlockAudio, true)
const player = createPlayerController(camera, worldOctree, spawnPoint, { onStep: () => sfx.footstep() })
const remotePlayers = createRemotePlayers(scene)

// GAME-04/GAME-13: a task prompt only makes sense for a Crewmate looking at
// one of their own, still-incomplete tasks; a vent/kill prompt only for the
// Impostor. assignedTaskIds/completedTaskIds are populated by the ROLE and
// task-completion handlers below.
const assignedTaskIds = new Set()
const completedTaskIds = new Set()
// taskId -> which step this player is on. The server is the authority; this
// mirror is what the prompt and the guide arrow read every frame.
const taskStepById = new Map()

function getPromptText(target) {
  const { kind } = target.userData
  if (kind === 'task') {
    const { taskId, stepIndex } = target.userData
    if (localRole !== 'crewmate') return null
    if (!assignedTaskIds.has(taskId) || completedTaskIds.has(taskId)) return null
    // A fetch task puts a console in two rooms; only the one you are due at
    // responds. Otherwise a player could "install the fuse" without ever
    // fetching it.
    if ((taskStepById.get(taskId) ?? 0) !== stepIndex) return null
    if (taskLockoutUntil.get(taskId) > Date.now()) return 'Console reiniciando…'
    return `Pressione E para ${getTaskById(taskId)?.steps[stepIndex]?.verb ?? 'fazer a tarefa'}`
  }
  if (kind === 'vent') {
    return localRole === 'impostor' ? 'Pressione E para usar o duto' : null
  }
  if (kind === 'eventPanel') {
    // Inert unless its own emergency is running and this panel still needs
    // someone; impostors get no prompt because the server refuses them.
    if (!activeEvent || target.userData.eventId !== activeEvent.eventId) return null
    if (!pendingPanelIds.has(target.userData.panelId)) return 'Painel acionado'
    if (localRole !== 'crewmate') return null
    return 'Pressione E para acionar o painel'
  }
  if (kind === 'emergencyButton') {
    return 'Pressione E para chamar reunião'
  }
  if (kind === 'player') {
    return localRole === 'impostor' ? 'Pressione E para atacar' : null
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
const healthUI = createHealthUI()
const spellUI = createSpellUI()
const taskGuide = createTaskGuide(scene, camera)
const carryUI = createCarryUI()
const eventUI = createEventUI()
const minimap = createMinimap(ROOM_LAYOUT, SKELD_CORRIDORS, { corridorWidth: CORRIDOR_WIDTH })
minimap.mount()
const ventTransition = createVentTransition()
const toast = createToast()

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
let localMaxHealth = 3
// Radar reveals every player on the map until this timestamp.
let radarUntil = 0
// The running ship emergency, if any. Its vision radius overrides the normal
// one, which is what makes a blackout actually dark rather than just loud.
let activeEvent = null
const pendingPanelIds = new Set()
let isHost = false
let deathNotice = null
let gameOverScreen = null
// Pending meeting phase timers. A restart clears gameEnded, so any survivor
// of the old match would fire against the new one - popping a voting screen
// over a fresh game.
let meetingTimers = []
// Suppresses task interaction while a meeting is up or the game has ended.
let interactionsPaused = false

// Every reason the player currently has a blocking screen in front of them.
// While this is non-empty the server pauses the bots AND refuses attacks on
// this player: being killed while staring at a voting screen you cannot act
// through is not a fair death, it is the game hitting you through a wall of
// UI. One set rather than a flag per screen, so no overlay can be added
// later that forgets to protect the player behind it.
const busyReasons = new Set()

function setBusy(reason, active) {
  const wasBusy = busyReasons.size > 0
  if (active) busyReasons.add(reason)
  else busyReasons.delete(reason)
  const isBusy = busyReasons.size > 0
  if (isBusy !== wasBusy) netClient?.send(MESSAGE_TYPE.BUSY, { busy: isBusy })
}
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
  if (deathNotice) return
  const notice = document.createElement('div')
  deathNotice = notice
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
// Where a task console physically is, from the same data the map is built
// from - so a guide arrow can never point somewhere the console is not.
// Arrows point at the step you are due at next, so a fetch task guides you
// to the pickup first and only then to where it is used.
// A blackout collapses vision for everyone, bots included (botRunner reads
// the same value server-side) - otherwise it would only handicap humans.
function currentVisionRadius() {
  // Impostors keep their eyes in a blackout. That asymmetry is the point of
  // cutting the lights, and botRunner applies the same rule server-side.
  if (localRole === 'impostor') return VISION_RADIUS
  return getEventById(activeEvent?.eventId)?.visionRadius ?? VISION_RADIUS
}

function refreshTaskGuide() {
  if (localRole !== 'crewmate') {
    taskGuide.clear()
    minimap.setTasks([])
    return
  }
  const targets = []
  // An emergency outranks tasks: while one runs, the arrows point at its
  // panels instead, or the player has no idea where to go for it.
  for (const panelId of pendingPanelIds) {
    const position = panelPosition(ROOM_LAYOUT, panelId)
    if (!position) continue
    const roomId = getEventById(activeEvent?.eventId)?.panels.find((p) => p.id === panelId)?.roomId
    targets.push({ taskId: panelId, position, roomName: ROOM_LABELS[roomId] ?? 'Emergência' })
  }
  for (const task of TASK_LOCATIONS) {
    if (!assignedTaskIds.has(task.id) || completedTaskIds.has(task.id)) continue
    const stepIndex = taskStepById.get(task.id) ?? 0
    const step = task.steps[stepIndex]
    if (!step) continue
    targets.push({
      taskId: task.id,
      position: stepPosition(ROOM_LAYOUT, task.id, stepIndex),
      roomName: ROOM_LABELS[step.roomId] ?? step.roomId,
    })
  }
  taskGuide.setTargets(targets)
  minimap.setTasks(targets.map((t) => ({ x: t.position[0], z: t.position[2] })))
}

// Intermediate steps are a single press - the trip is the content. Only the
// final step asks the educational question, so a fetch task is not two
// quizzes.
function doTaskStep(taskId, stepIndex) {
  if (localRole !== 'crewmate') return
  if (!assignedTaskIds.has(taskId) || completedTaskIds.has(taskId)) return
  if ((taskStepById.get(taskId) ?? 0) !== stepIndex) return
  if ((taskLockoutUntil.get(taskId) ?? 0) > Date.now()) return
  if (taskQuiz.isOpen()) return

  const task = getTaskById(taskId)
  const isFinalStep = stepIndex >= task.steps.length - 1
  if (!isFinalStep) {
    netClient.send(MESSAGE_TYPE.TASK_COMPLETE, { taskId })
    sfx.taskProgress()
    return
  }
  openTaskQuiz(taskId)
}

function openTaskQuiz(taskId) {

  player.setFrozen(true)
  document.exitPointerLock()
  // Ask the server to hold the bots while the question is on screen. Being
  // killed part-way through a sum punishes precisely the behaviour the
  // educational tasks exist to encourage (AD-009).
  setBusy('quiz', true)

  taskQuiz.show(drawTaskQuestion(Math.random), (result) => {
    setBusy('quiz', false)
    if (!gameEnded && !interactionsPaused) player.setFrozen(false)

    if (result === 'correct') {
      // The server confirms via TASK_STEP; the local marks happen there so
      // the HUD can never claim a task the server refused.
      netClient.send(MESSAGE_TYPE.TASK_COMPLETE, { taskId })
    } else if (result === 'wrong') {
      // The cost of a wrong answer: this console is unusable for a few
      // seconds and will ask a different question next time.
      taskLockoutUntil.set(taskId, Date.now() + WRONG_ANSWER_LOCKOUT_MS)
    }
  })
}

// The server's livingPlayers payload carries id and name only; the colour
// each player is drawn in lives in the roster, so the meeting screens are
// enriched here rather than widening the protocol.
function withColors(livingPlayers) {
  return livingPlayers.map((entry) => ({
    ...entry,
    colorIndex: roster.get(entry.id)?.colorIndex,
  }))
}

function castSpell() {
  if (!started || gameEnded || !netClient || !localAlive) return
  if (interactionsPaused || taskQuiz.isOpen()) return
  if (!spellUI.hasSpell() || spellUI.isSpent()) return
  // The server is the authority on whether the charge is still there; the
  // local check only avoids obviously pointless traffic.
  netClient.send(MESSAGE_TYPE.CAST_SPELL, {
    position: [camera.position.x, camera.position.y, camera.position.z],
  })
}

function handleInteractPress() {
  if (!started || gameEnded || !netClient || !localAlive) return
  if (interactionsPaused || taskQuiz.isOpen()) return
  const target = interactSystem.getTarget()
  if (!target) return

  const { kind } = target.userData
  if (kind === 'task') {
    doTaskStep(target.userData.taskId, target.userData.stepIndex)
  } else if (kind === 'vent' && localRole === 'impostor') {
    netClient.send(MESSAGE_TYPE.VENT, { ventId: target.userData.ventId })
  } else if (kind === 'eventPanel') {
    if (activeEvent && target.userData.eventId === activeEvent.eventId) {
      netClient.send(MESSAGE_TYPE.ARM_PANEL, { panelId: target.userData.panelId })
    }
  } else if (kind === 'emergencyButton') {
    netClient.send(MESSAGE_TYPE.CALL_MEETING, {})
  } else if (kind === 'player' && localRole === 'impostor') {
    netClient.send(MESSAGE_TYPE.ATTACK, { targetId: target.userData.killTargetId })
  }
}

document.addEventListener('keydown', (event) => {
  if (event.code === 'KeyQ' && !event.repeat) {
    castSpell()
    return
  }
  if (event.code === 'Tab') {
    // Tab moves focus by default, which would pull it out of the canvas.
    event.preventDefault()
    if (started) setBusy('map', minimap.toggle())
    return
  }
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
  // rather than second-guessing it here. Once the match has begun the lobby
  // overlay is gone from the DOM, so writing there would be invisible - a
  // rejected action would look like a dead button.
  netClient.on(MESSAGE_TYPE.ERROR, (msg) => {
    if (started) toast.show(msg.message)
    else lobby.showConnectionError(msg.message)
  })

  netClient.on(MESSAGE_TYPE.WELCOME, (msg) => {
    localPlayerId = msg.playerId
    isHost = msg.isHost
    lobby.setIsHost(msg.isHost)
    // Connected: the name/host/join controls have done their job, so the
    // lobby becomes the waiting room rather than a form nobody can use again.
    lobby.setConnected()
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
    localMaxHealth = msg.maxHealth ?? 3
    remotePlayers.resetHealth()
    healthUI.show(localMaxHealth, localMaxHealth)
    spellUI.setSpell(msg.spellId)
    radarUntil = 0
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
    taskStepById.clear()
    carryUI.set(null)
    refreshTaskGuide()
  })

  // The server is the authority on task progress; every local mark happens
  // here, on its confirmation, rather than optimistically.
  netClient.on(MESSAGE_TYPE.TASK_STEP, (msg) => {
    taskStepById.set(msg.taskId, msg.step)
    if (msg.completed) {
      completedTaskIds.add(msg.taskId)
      sfx.taskDone()
      roleUI.markTaskDone(msg.taskId)
      carryUI.set(null)
    } else {
      const step = getTaskById(msg.taskId)?.steps[msg.step - 1]
      carryUI.set(step?.carrying ?? null)
    }
    refreshTaskGuide()
  })

  netClient.on(MESSAGE_TYPE.EVENT_STARTED, (msg) => {
    activeEvent = msg
    pendingPanelIds.clear()
    for (const panelId of msg.panelIds) pendingPanelIds.add(panelId)
    eventUI.show(msg)
    sfx.meeting()
    refreshTaskGuide()
  })

  netClient.on(MESSAGE_TYPE.EVENT_PANEL, (msg) => {
    pendingPanelIds.delete(msg.panelId)
    sfx.taskProgress()
    refreshTaskGuide()
  })

  netClient.on(MESSAGE_TYPE.EVENT_ENDED, (msg) => {
    const name = getEventById(msg.eventId)?.name ?? 'Emergência'
    activeEvent = null
    pendingPanelIds.clear()
    eventUI.showOutcome(name, msg.fixed)
    if (msg.fixed) sfx.win()
    refreshTaskGuide()
  })

  netClient.on(MESSAGE_TYPE.TASKS_PROGRESS, (msg) => {
    roleUI.updateProgress(msg.completed, msg.total)
  })

  netClient.on(MESSAGE_TYPE.SPELL_CAST, (msg) => {
    const spell = getSpellById(msg.spellId)
    if (!spell) return
    const isMine = msg.playerId === localPlayerId
    if (isMine) spellUI.markSpent()

    if (spell.id === 'clarao') {
      sfx.vent()
      if (isMine) {
        player.setSpeedMultiplier(1.9, spell.hasteSeconds)
      } else if (
        localAlive &&
        msg.position &&
        navGraph.canSee(camera.position.x, camera.position.z, msg.position[0], msg.position[2], VISION_RADIUS)
      ) {
        // Only people who could actually see the flash are blinded - the
        // same line-of-sight rule the rest of the game uses.
        spellUI.blindFor(spell.blindSeconds)
        player.setSpeedMultiplier(0.35, spell.blindSeconds)
      }
      return
    }

    if (spell.id === 'radar' && isMine) {
      radarUntil = Date.now() + spell.revealSeconds * 1000
      minimap.reveal(spell.revealSeconds)
      sfx.taskDone()
      return
    }

    if (spell.id === 'embaralhar') sfx.meeting()
  })

  netClient.on(MESSAGE_TYPE.PLAYER_HURT, (msg) => {
    remotePlayers.setHealth(msg.id, msg.health)

    if (msg.id === localPlayerId) {
      // Being hit: the red vignette and the drop in your own hearts.
      healthUI.hit(msg.health)
      sfx.kill()
      return
    }

    // Landing a hit. Without this the attacker got no feedback at all - the
    // only thing that changed was the victim's hearts, which sit above their
    // head behind the crosshair - so a working attack was indistinguishable
    // from a key that does nothing.
    if (msg.attackerId === localPlayerId) {
      healthUI.enemyHit(msg.health)
      sfx.taskProgress()
    }
  })

  netClient.on(MESSAGE_TYPE.PLAYER_DIED, (msg) => {
    remotePlayers.remove(msg.id)
    if (msg.id === localPlayerId) {
      localAlive = false
      healthUI.hide()
      sfx.death()
      showDeathNotice()
    }
  })

  netClient.on(MESSAGE_TYPE.MEETING_STARTED, (msg) => {
    player.setFrozen(true)
    interactionsPaused = true
    setBusy('meeting', true)
    taskQuiz.cancel()
    minimap.hide()
    // Pointer lock captures the mouse for camera look, so the vote buttons
    // below would never receive a click while locked - release it here; the
    // pointer-lock overlay's own "click to resume" flow handles regaining it
    // once the meeting ends (browsers require a user gesture to re-lock).
    document.exitPointerLock()
    sfx.meeting()
    meetingUI.showDiscussion(msg.discussionSeconds, withColors(msg.livingPlayers))
    meetingTimers.push(setTimeout(() => {
      // localAlive is read here, not when the meeting started, so a player
      // killed during the discussion phase still loses the vote.
      if (!gameEnded) meetingUI.showVoting(withColors(msg.livingPlayers), msg.votingSeconds, localAlive)
    }, msg.discussionSeconds * 1000))
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
    meetingUI.showResult(ejectedName, roster.get(msg.ejectedId)?.colorIndex, msg.wasImpostor)
    meetingTimers.push(setTimeout(() => {
      if (!gameEnded) {
        meetingUI.hide()
        player.setFrozen(false)
        interactionsPaused = false
        // Cleared only here, not when the server ends the meeting: the result
        // screen stays up for several seconds afterwards, and during those
        // seconds the match is already back to 'playing' and the bots are
        // moving again. That gap is exactly where players were being killed
        // behind an overlay they could not see past.
        setBusy('meeting', false)
      }
    }, MEETING_RESULT_DISPLAY_MS))
  })

  netClient.on(MESSAGE_TYPE.GAME_OVER, (msg) => {
    gameEnded = true
    interactionsPaused = true
    setBusy('gameover', true)
    player.setFrozen(true)
    document.exitPointerLock()
    meetingUI.hide()
    const iWon = (msg.winner === 'crew') === (localRole !== 'impostor')
    if (iWon) sfx.win()
    else sfx.lose()
    const impostorIds = msg.impostorIds ?? []
    const impostors = impostorIds.map((id) => ({
      name: roster.get(id)?.name ?? (id === localPlayerId ? 'você' : 'Desconhecido'),
      colorIndex: roster.get(id)?.colorIndex,
    }))
    // Never stack two of these: a second gameOver would leave an identical
    // overlay underneath the one being dismissed, which reads as a dead
    // restart button.
    gameOverScreen?.remove()
    gameOverScreen = showGameOver(msg.winner, impostors, {
      // Only the host can start a match - the server rejects `start` from
      // anyone else - so only the host gets the button.
      canRestart: isHost,
      onRestart: () => netClient.send(MESSAGE_TYPE.START, { impostorCount: lobby.getImpostorCount() }),
    })
  })

  netClient.on(MESSAGE_TYPE.TELEPORT, (msg) => {
    // The move happens at the midpoint, while the screen is black, so the
    // player never sees the world snap - they see themselves go into a duct
    // and come out somewhere else.
    sfx.vent()
    ventTransition.play(() => player.teleportTo(msg.position))
  })

  netClient.on(MESSAGE_TYPE.START, () => {
    // A second `start` means "play again". The 3D world, socket and input
    // wiring are all still valid, so only the per-match state is torn down
    // rather than re-running startGame (which would stack a second animate
    // loop and duplicate every input listener - see STATE.md L-005).
    if (started) resetForNewMatch()
    else startGame(lobby)
  })
}

// Returns the client to a clean pre-match state so the same session can
// play another round. Everything listed here is per-match state that would
// otherwise leak into the new game: a stale "you are dead" banner, ghosts of
// last round's avatars, completed-task ticks, console lockouts.
function resetForNewMatch() {
  gameEnded = false
  localAlive = true
  localRole = null
  interactionsPaused = false

  for (const timer of meetingTimers) clearTimeout(timer)
  meetingTimers = []

  healthUI.hide()
  spellUI.hide()
  taskGuide.clear()
  radarUntil = 0
  remotePlayers.resetHealth()

  assignedTaskIds.clear()
  completedTaskIds.clear()
  taskLockoutUntil.clear()
  taskStepById.clear()

  for (const id of [...roster.keys()]) remotePlayers.remove(id)

  taskQuiz.cancel()
  minimap.hide()
  meetingUI.hide()
  eventUI.hide()
  activeEvent = null
  pendingPanelIds.clear()
  roleUI.reset()
  busyReasons.clear()
  netClient?.send(MESSAGE_TYPE.BUSY, { busy: false })
  gameOverScreen?.remove()
  gameOverScreen = null
  deathNotice?.remove()
  deathNotice = null

  player.teleportTo([spawnPoint.x, spawnPoint.y, spawnPoint.z])
  player.setFrozen(false)
}

function startGame(lobby) {
  if (started) return
  started = true
  lobby.hide()
  const pointerLock = initPointerLockOverlay(canvas)
  pointerLock.onActivate(unlockAudio)

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
    // Radar is the one sanctioned exception to limited vision, and it is
    // scoped to the map only - the 3D avatars stay hidden either way.
    const radarActive = Date.now() < radarUntil
    const mapMarkers = []
    remotePlayers.applyVisibility((id, position) => {
      const seen = navGraph.canSee(camera.position.x, camera.position.z, position.x, position.z, currentVisionRadius())
      if (seen || radarActive) {
        mapMarkers.push({ x: position.x, z: position.z, colorIndex: roster.get(id)?.colorIndex, faded: !seen })
      }
      return seen
    })
    minimap.render(camera.position, roster.get(localPlayerId)?.colorIndex, mapMarkers)

    // Actually make it dark. Without this the "blackout" would only shorten
    // the vision rule while the room stayed brightly lit, which reads as a
    // bug rather than a power cut.
    const blackout = localRole !== 'impostor' && Boolean(getEventById(activeEvent?.eventId)?.visionRadius)
    hemiLight.intensity = blackout ? 0.12 : 1.1
    dirLight.intensity = blackout ? 0.05 : 0.55
    scene.fog.near = blackout ? 1 : 18
    scene.fog.far = blackout ? 9 : 60
    interactSystem.update()
    taskGuide.update(clock.elapsedTime)

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
  onStart(impostorCount) {
    netClient.send(MESSAGE_TYPE.START, { impostorCount })
  },
})

// A research challenge to work on while waiting for the match to fill.
lobby.showResearchChallenge(drawResearchQuestion(Math.random))
