import { createNavGraph } from '../shared/navGraph.js'
import { ROOM_LAYOUT } from '../shared/skeldRooms.js'
import { SKELD_CORRIDORS } from '../shared/skeldCorridors.js'
import { TASK_LOCATIONS } from '../shared/taskPool.js'
import { VENT_LOCATIONS } from '../shared/ventPool.js'
import { createBotBrain } from './botBrain.js'
import * as gameState from './gameState.js'

const TICK_HZ = 15
const TICK_MS = 1000 / TICK_HZ
// Roughly a human's settled walking speed (see playerController's
// WALK_ACCELERATION note - terminal velocity lands around 5 u/s), so bot
// motion doesn't read as obviously faster or slower than a real player's.
const WALK_SPEED = 4.5
const EYE_HEIGHT = 1.35

// How far a bot can "see". Also the radius used to decide who witnessed a
// kill or a vent, which is what keeps bot knowledge honest (bot-players P3).
const SENSE_RADIUS = 9
const KILL_RANGE = 2.5

const KILL_COOLDOWN_MS = 15000
// The impostor bot doesn't kill the instant it finds a lone target at match
// start - spec BOT-06 asks for a cooldown so it isn't the same opening move
// every game.
const OPENING_KILL_GRACE_MS = 15000
const VENT_COOLDOWN_MS = 25000
const VENT_CHANCE_PER_TICK = 0.02
const TASK_HOLD_SECONDS = 2

const BOT_NAMES = ['Rex', 'Nina', 'Caio', 'Duda', 'Théo', 'Alice', 'Bruno', 'Lia']

function distance2D(a, b) {
  return Math.hypot(a[0] - b[0], a[2] - b[2])
}

export function createBotRunner({ gameActions, getMatch, getPlayers, getHumanPositions, broadcastState, randomFn = Math.random }) {
  const nav = createNavGraph(ROOM_LAYOUT, SKELD_CORRIDORS)
  const bots = new Map()
  let tickTimer = null
  let matchStartedAt = 0
  let seq = 0

  function isBot(playerId) {
    return bots.has(playerId)
  }

  function spawnBots(count, existingNames, spawnPosition) {
    const taken = new Set(existingNames)
    const created = []
    for (let i = 0; i < count; i += 1) {
      const name = BOT_NAMES.find((candidate) => !taken.has(candidate)) ?? `Bot ${i + 1}`
      taken.add(name)
      const id = `bot-${i}-${Math.floor(randomFn() * 1e9).toString(36)}`
      bots.set(id, {
        id,
        name,
        position: [spawnPosition[0] + (randomFn() - 0.5) * 4, EYE_HEIGHT, spawnPosition[2] + (randomFn() - 0.5) * 4],
        rotationY: 0,
        path: null,
        pathIndex: 0,
        brain: createBotBrain(id, randomFn),
        completedTaskIds: new Set(),
        goalTaskId: null,
        taskHoldRemaining: 0,
        nextKillAllowedAt: 0,
        nextVentAllowedAt: 0,
        voteTimer: null,
      })
      created.push({ id, name })
    }
    return created
  }

  // Every living player's position, bots and humans alike - sensing must not
  // care which is which.
  function allLivingPositions() {
    const match = getMatch()
    const positions = new Map()
    for (const [id, position] of getHumanPositions()) {
      if (!match || gameState.isAlive(match, id)) positions.set(id, position)
    }
    for (const [id, bot] of bots) {
      if (!match || gameState.isAlive(match, id)) positions.set(id, bot.position)
    }
    return positions
  }

  // Line of sight, not just proximity - a pure distance check let bots see
  // through walls (see STATE.md L-014). The predicate itself lives in
  // shared/navGraph so the client's limited-vision rendering uses the exact
  // same rule: a bot and a human standing in the same spot must see the same
  // set of people.
  function canSee(fromPosition, toPosition) {
    return nav.canSee(fromPosition[0], fromPosition[2], toPosition[0], toPosition[2], SENSE_RADIUS)
  }

  function playersNear(position, positions, excludeId) {
    const near = []
    for (const [id, other] of positions) {
      if (id === excludeId) continue
      if (canSee(position, other)) near.push(id)
    }
    return near
  }

  // Advances the bot along its current polyline. Returns true once the final
  // waypoint is reached.
  function advanceAlongPath(bot, budget) {
    let remaining = budget
    while (remaining > 0 && bot.path && bot.pathIndex < bot.path.length) {
      const [targetX, targetZ] = bot.path[bot.pathIndex]
      const dx = targetX - bot.position[0]
      const dz = targetZ - bot.position[2]
      const step = Math.hypot(dx, dz)

      if (step <= 1e-6) {
        bot.pathIndex += 1
        continue
      }
      // Matches playerController's yaw convention: forward is
      // (-sin(yaw), -cos(yaw)), so facing (dx, dz) means yaw = atan2(-dx, -dz).
      bot.rotationY = Math.atan2(-dx, -dz)

      if (step <= remaining) {
        bot.position[0] = targetX
        bot.position[2] = targetZ
        remaining -= step
        bot.pathIndex += 1
      } else {
        bot.position[0] += (dx / step) * remaining
        bot.position[2] += (dz / step) * remaining
        remaining = 0
      }
    }
    return !bot.path || bot.pathIndex >= bot.path.length
  }

  function setPath(bot, roomId, offset) {
    const points = nav.waypointsTo([bot.position[0], bot.position[2]], roomId, offset)
    bot.path = points
    bot.pathIndex = points ? 1 : 0
  }

  function wander(bot) {
    const currentRoom = nav.roomIdAt(bot.position[0], bot.position[2]) ?? nav.nearestRoomId(bot.position[0], bot.position[2])
    const next = nav.randomAdjacentRoom(currentRoom, randomFn) ?? currentRoom
    setPath(bot, next, null)
  }

  function nextIncompleteTask(bot, match) {
    const assigned = gameState.getAssignedTasks(match, bot.id)
    const remaining = assigned.filter((taskId) => !bot.completedTaskIds.has(taskId))
    if (remaining.length === 0) return null
    return TASK_LOCATIONS.find((task) => task.id === remaining[0]) ?? null
  }

  function stepCrewmate(bot, match, deltaSeconds) {
    if (bot.taskHoldRemaining > 0) {
      bot.taskHoldRemaining -= deltaSeconds
      if (bot.taskHoldRemaining <= 0 && bot.goalTaskId) {
        gameActions.doTaskComplete(bot.id, bot.goalTaskId)
        bot.completedTaskIds.add(bot.goalTaskId)
        bot.goalTaskId = null
        bot.path = null
      }
      return
    }

    const arrived = advanceAlongPath(bot, WALK_SPEED * deltaSeconds)
    if (!arrived) return

    const task = nextIncompleteTask(bot, match)
    if (!task) {
      wander(bot)
      return
    }

    if (bot.goalTaskId === task.id) {
      // Standing on the task - hold it for the same duration a human must.
      bot.taskHoldRemaining = TASK_HOLD_SECONDS
      return
    }

    bot.goalTaskId = task.id
    setPath(bot, task.roomId, task.offset)
  }

  function stepImpostor(bot, match, deltaSeconds, positions, now) {
    const witnesses = playersNear(bot.position, positions, bot.id)

    // BOT-06/BOT-04: kill only when exactly one other living player is
    // around, i.e. there is nobody left to witness it.
    if (witnesses.length === 1 && now >= bot.nextKillAllowedAt) {
      const targetId = witnesses[0]
      const targetPosition = positions.get(targetId)
      if (targetPosition && distance2D(bot.position, targetPosition) <= KILL_RANGE) {
        if (gameActions.doKill(bot.id, targetId)) {
          bot.nextKillAllowedAt = now + KILL_COOLDOWN_MS
          bot.path = null
          return
        }
      } else {
        // Stalk: close the distance on the isolated target. A straight line
        // is only safe when both are inside the same open room - otherwise
        // it cuts through walls, so fall back to a routed path.
        const botRoom = nav.roomIdAt(bot.position[0], bot.position[2])
        const targetRoom = nav.roomIdAt(targetPosition[0], targetPosition[2])
        if (botRoom && botRoom === targetRoom) {
          bot.path = [[bot.position[0], bot.position[2]], [targetPosition[0], targetPosition[2]]]
          bot.pathIndex = 1
        } else if (targetRoom) {
          setPath(bot, targetRoom, null)
        }
      }
    }

    if (witnesses.length === 0 && now >= bot.nextVentAllowedAt && randomFn() < VENT_CHANCE_PER_TICK) {
      const roomId = nav.roomIdAt(bot.position[0], bot.position[2])
      const vent = VENT_LOCATIONS.find((v) => v.roomId === roomId)
      if (vent) {
        const result = gameActions.doVent(bot.id, vent.id)
        if (result) {
          bot.position = [...result.position]
          bot.nextVentAllowedAt = now + VENT_COOLDOWN_MS
          bot.path = null
          return
        }
      }
    }

    const arrived = advanceAlongPath(bot, WALK_SPEED * deltaSeconds)
    if (arrived) hunt(bot, positions)
  }

  // Rather than wandering blindly (which leaves the impostor waiting for a
  // lone target to happen to walk past, and can stall a match indefinitely),
  // head for whoever is currently most isolated - preferring fewer bystanders
  // first, then proximity. That produces the kill opportunities BOT-06 then
  // gates on, without ever letting the impostor kill in front of witnesses.
  function hunt(bot, positions) {
    let bestId = null
    let bestScore = Infinity
    for (const [id, position] of positions) {
      if (id === bot.id) continue
      const bystanders = playersNear(position, positions, id).filter((other) => other !== bot.id).length
      const score = bystanders * 100 + distance2D(bot.position, position)
      if (score < bestScore) {
        bestScore = score
        bestId = id
      }
    }

    const targetPosition = bestId && positions.get(bestId)
    if (!targetPosition) {
      wander(bot)
      return
    }

    const targetRoom = nav.roomIdAt(targetPosition[0], targetPosition[2])
    if (!targetRoom) {
      wander(bot)
      return
    }
    setPath(bot, targetRoom, null)
  }

  function tick() {
    const match = getMatch()
    if (!match || match.phase !== 'playing') return

    const now = Date.now()
    const deltaSeconds = TICK_MS / 1000
    const positions = allLivingPositions()
    seq += 1

    for (const bot of bots.values()) {
      if (!gameState.isAlive(match, bot.id)) continue
      try {
        const roomId = nav.roomIdAt(bot.position[0], bot.position[2])
        bot.brain.noteNearbyPlayers(playersNear(bot.position, positions, bot.id), roomId, now)

        // Repeat attempts are harmless: once one bot succeeds the phase is
        // no longer 'playing', so doCallMeeting rejects the rest, and
        // onMeetingEnded clears everyone's pending reports.
        if (bot.brain.shouldCallMeeting(now)) {
          gameActions.doCallMeeting(bot.id)
          continue
        }

        if (gameState.getRole(match, bot.id) === 'impostor') {
          stepImpostor(bot, match, deltaSeconds, positions, now)
        } else {
          stepCrewmate(bot, match, deltaSeconds)
        }

        broadcastState(bot.id, [bot.position[0], EYE_HEIGHT, bot.position[2]], bot.rotationY, seq)
      } catch {
        // One misbehaving bot must never take down the simulation loop for
        // everyone else; it simply idles this tick.
        bot.path = null
      }
    }
  }

  // --- event hooks, wired into gameActions ---

  // Only brains whose bot was actually within SENSE_RADIUS at this instant
  // are told. This is where the "bots only know what they witnessed"
  // guarantee is physically enforced.
  function fanOutSighting(originId, notify) {
    const positions = allLivingPositions()
    const origin = positions.get(originId)
    if (!origin) return
    for (const bot of bots.values()) {
      if (bot.id === originId) continue
      if (!canSee(bot.position, origin)) continue
      notify(bot, nav.roomIdAt(origin[0], origin[2]))
    }
  }

  function onKill(killerId, victimId) {
    const now = Date.now()
    // The death itself is public (the server broadcasts playerDied to
    // everyone), but *who did it* only reaches bots that were close enough
    // to see it happen.
    for (const bot of bots.values()) bot.brain.noteDeath(victimId, now)
    fanOutSighting(killerId, (bot, roomId) => bot.brain.noteWitnessedKill(killerId, victimId, roomId, now))
  }

  function onVent(playerId) {
    const now = Date.now()
    fanOutSighting(playerId, (bot, roomId) => bot.brain.noteWitnessedVent(playerId, roomId, now))
  }

  function onMeetingStarted({ discussionSeconds, votingSeconds }) {
    const match = getMatch()
    if (!match) return
    for (const bot of bots.values()) {
      if (!gameState.isAlive(match, bot.id)) continue
      bot.path = null
      bot.taskHoldRemaining = 0
      // Vote at a random point inside the voting window, so the meeting
      // doesn't resolve the instant discussion ends and humans still get
      // their full time to decide.
      const delayMs = (discussionSeconds + votingSeconds * (0.3 + randomFn() * 0.5)) * 1000
      bot.voteTimer = setTimeout(() => {
        const current = getMatch()
        if (!current || current.phase !== 'meeting') return
        const living = [...current.alive]
        gameActions.doVote(bot.id, bot.brain.decideVote(living, randomFn, Date.now()))
      }, delayMs)
    }
  }

  function onMeetingEnded() {
    for (const bot of bots.values()) {
      if (bot.voteTimer) {
        clearTimeout(bot.voteTimer)
        bot.voteTimer = null
      }
      bot.brain.clearAfterMeeting()
    }
  }

  function start() {
    matchStartedAt = Date.now()
    for (const bot of bots.values()) {
      bot.nextKillAllowedAt = matchStartedAt + OPENING_KILL_GRACE_MS
    }
    if (!tickTimer) tickTimer = setInterval(tick, TICK_MS)
  }

  function stop() {
    if (tickTimer) {
      clearInterval(tickTimer)
      tickTimer = null
    }
    for (const bot of bots.values()) {
      if (bot.voteTimer) clearTimeout(bot.voteTimer)
    }
    bots.clear()
  }

  return {
    spawnBots,
    start,
    stop,
    isBot,
    hooks: { onKill, onVent, onMeetingStarted, onMeetingEnded, onGameOver: () => stop() },
  }
}
