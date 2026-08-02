import { MESSAGE_TYPE } from '../shared/protocol.js'
import { ROOM_LAYOUT } from '../shared/skeldRooms.js'
import { VENT_LOCATIONS, getVentDestination } from '../shared/ventPool.js'
import * as gameState from './gameState.js'

export const DISCUSSION_SECONDS = 15
export const VOTING_SECONDS = 20
// Matches playerController's settled eye height (capsule radius + half its
// segment height) so a teleported player doesn't visibly pop up/down.
export const TELEPORT_EYE_HEIGHT = 1.35

function ventPosition(ventId) {
  const vent = VENT_LOCATIONS.find((v) => v.id === ventId)
  const room = ROOM_LAYOUT.find((r) => r.id === vent.roomId)
  return [room.center[0] + vent.offset[0], TELEPORT_EYE_HEIGHT, room.center[2] + vent.offset[2]]
}

// Every in-match action, keyed on playerId rather than on a socket, so a
// bot (which has no socket to send itself a message) and a human run the
// exact same validation, state change, broadcast, and win check. Duplicating
// these for bots would guarantee the two copies drift - see bot-players
// spec.md BOT-02.
//
// `hooks` lets the bot layer observe events it could plausibly witness
// (kills, vents) without this module having to know bots exist.
export function createGameActions({ getMatch, setMatch, getPlayers, broadcastToAll, sendToPlayer, isBusy = () => false, hooks = {} }) {
  let meetingTimer = null

  // checkTasks: false for every path triggered by a death (kill/ejection/
  // disconnect) - a death must never itself complete the task-win condition,
  // only an actual TASK_COMPLETE should (see gameState.checkWinCondition).
  function checkAndBroadcastWin(checkTasks) {
    const match = getMatch()
    if (!match) return
    // Once a match is over it stays over. Without this, any later path that
    // reaches here (a disconnect, for one - doPlayerLeft is not phase-gated)
    // re-broadcasts gameOver, and a client that builds a fresh overlay per
    // message ends up with two stacked: dismissing the top one reveals an
    // identical one underneath, which looks exactly like a dead button.
    if (match.phase === 'gameOver') return
    const winner = gameState.checkWinCondition(match, { checkTasks })
    if (!winner) return
    match.phase = 'gameOver'
    broadcastToAll(MESSAGE_TYPE.GAME_OVER, { winner, impostorIds: gameState.getImpostorIds(match) })
    hooks.onGameOver?.()
  }

  function finishMeeting() {
    const match = getMatch()
    if (!match) return
    if (meetingTimer) {
      clearTimeout(meetingTimer)
      meetingTimer = null
    }
    const { ejectedId, wasImpostor } = gameState.tallyVotes(match)
    if (ejectedId) gameState.recordDeath(match, ejectedId)
    gameState.endMeeting(match)
    broadcastToAll(MESSAGE_TYPE.MEETING_RESULT, { ejectedId, wasImpostor })
    hooks.onMeetingEnded?.(ejectedId)
    checkAndBroadcastWin(false)
  }

  function startMatch(playerIds, options) {
    const match = gameState.createMatch(playerIds, Math.random, options)
    setMatch(match)
    for (const playerId of playerIds) {
      sendToPlayer(playerId, MESSAGE_TYPE.ROLE, {
        role: gameState.getRole(match, playerId),
        taskIds: gameState.getAssignedTasks(match, playerId),
        maxHealth: gameState.MAX_HEALTH,
        spellId: gameState.getSpell(match, playerId),
        impostorCount: gameState.getImpostorIds(match).length,
      })
    }
    return match
  }

  // A task is a chain of steps. Every press advances one; only the last one
  // finishes the task and can move the win condition. Intermediate steps
  // deliberately broadcast nothing global - a player carrying a fuse across
  // the ship has not made progress the crew can count yet.
  function doTaskStep(playerId, taskId) {
    const match = getMatch()
    if (!match || match.phase !== 'playing') return null
    if (!playerId || !gameState.isAlive(match, playerId)) return null
    if (gameState.getRole(match, playerId) !== 'crewmate') return null
    if (!gameState.getAssignedTasks(match, playerId).includes(taskId)) return null

    const { step, completed } = gameState.advanceTaskStep(match, playerId, taskId)
    if (step === null) return null

    sendToPlayer(playerId, MESSAGE_TYPE.TASK_STEP, { taskId, step, completed })
    if (!completed) return { step, completed }

    const progress = gameState.completeTask(match, playerId, taskId)
    broadcastToAll(MESSAGE_TYPE.TASKS_PROGRESS, { completed: progress.completed, total: progress.total })
    checkAndBroadcastWin(true)
    return { step, completed }
  }

  // One hit, not one kill. Only the blow that empties the health bar ends a
  // life, and only that blow re-checks the win condition - a non-fatal hit
  // changes nothing the win rules care about.
  function doAttack(playerId, targetId) {
    const match = getMatch()
    if (!match || match.phase !== 'playing') return false
    if (!playerId || gameState.getRole(match, playerId) !== 'impostor') return false
    if (!gameState.isAlive(match, playerId)) return false
    if (targetId === playerId || !gameState.isAlive(match, targetId)) return false
    // Impostors cannot attack each other.
    if (gameState.getRole(match, targetId) === 'impostor') return false
    // Nor can anyone be hit while a blocking screen is up on their end - a
    // meeting result, the game-over screen, a task question, the map. They
    // cannot see or react through it, so a hit there is not a fair kill.
    if (isBusy(targetId)) return false

    const { health, died } = gameState.damage(match, targetId)
    // Broadcast to everyone: health is shown above every player's head, so
    // this is the one place combat state deliberately travels past the
    // limited-vision rule.
    broadcastToAll(MESSAGE_TYPE.PLAYER_HURT, { id: targetId, health, attackerId: playerId })
    hooks.onAttack?.(playerId, targetId, died)

    if (!died) return true
    broadcastToAll(MESSAGE_TYPE.PLAYER_DIED, { id: targetId, cause: 'killed' })
    checkAndBroadcastWin(false)
    return true
  }

  function doCallMeeting(playerId) {
    const match = getMatch()
    if (!match || match.phase !== 'playing') return false
    if (!playerId || !gameState.isAlive(match, playerId)) return false

    gameState.startMeeting(match)
    const players = getPlayers()
    const livingPlayers = [...match.alive].map((id) => ({ id, name: players.get(id)?.name ?? 'Jogador' }))
    broadcastToAll(MESSAGE_TYPE.MEETING_STARTED, {
      livingPlayers,
      discussionSeconds: DISCUSSION_SECONDS,
      votingSeconds: VOTING_SECONDS,
    })
    meetingTimer = setTimeout(finishMeeting, (DISCUSSION_SECONDS + VOTING_SECONDS) * 1000)
    hooks.onMeetingStarted?.({
      livingPlayers,
      discussionSeconds: DISCUSSION_SECONDS,
      votingSeconds: VOTING_SECONDS,
    })
    return true
  }

  function doVote(playerId, targetId) {
    const match = getMatch()
    if (!match || match.phase !== 'meeting') return false
    if (!playerId || !gameState.isAlive(match, playerId)) return false
    if (targetId !== 'skip' && !gameState.isAlive(match, targetId)) return false

    gameState.castVote(match, playerId, targetId)
    if (match.votes.size >= match.alive.size) finishMeeting()
    return true
  }

  // Returns the destination position rather than only sending it, so the bot
  // layer can move its own simulated body to the same place a human client
  // would teleport itself to on receiving the message.
  function doVent(playerId, ventId) {
    const match = getMatch()
    if (!match || match.phase !== 'playing') return null
    if (!playerId || gameState.getRole(match, playerId) !== 'impostor') return null
    if (!gameState.isAlive(match, playerId)) return null

    const destinationVentId = getVentDestination(ventId)
    if (!destinationVentId) return null

    const position = ventPosition(destinationVentId)
    sendToPlayer(playerId, MESSAGE_TYPE.TELEPORT, { position })
    hooks.onVent?.(playerId, ventId, destinationVentId)
    return { destinationVentId, position }
  }

  // Casting is broadcast to everyone: the effects are things other players
  // must react to (being blinded, being teleported), and who cast it is
  // deliberately public - a crewmate spending their charge is claiming
  // innocence in front of witnesses.
  //
  // `position` comes from the caster, like every other position in this
  // relay-model server (AD-002, LAN-trusted).
  function doCastSpell(playerId, position) {
    const match = getMatch()
    if (!match || match.phase !== 'playing') return null
    if (!playerId) return null
    const spellId = gameState.getSpell(match, playerId)
    if (!gameState.useSpell(match, playerId)) return null

    broadcastToAll(MESSAGE_TYPE.SPELL_CAST, { playerId, spellId, position })
    hooks.onSpellCast?.(playerId, spellId, position)
    return spellId
  }

  // The game-rules half of a disconnect; the caller still owns removing the
  // player from the roster/socket maps.
  function doPlayerLeft(playerId) {
    const match = getMatch()
    if (!match || match.phase === 'gameOver') return
    if (!gameState.isAlive(match, playerId)) return
    if (playerId === match.impostorId) {
      match.phase = 'gameOver'
      broadcastToAll(MESSAGE_TYPE.GAME_OVER, { winner: 'crew', impostorId: match.impostorId })
      hooks.onGameOver?.()
      return
    }
    gameState.recordDeath(match, playerId)
    checkAndBroadcastWin(false)
  }

  function cancelTimers() {
    if (meetingTimer) {
      clearTimeout(meetingTimer)
      meetingTimer = null
    }
  }

  function isAlive(playerId) {
    const match = getMatch()
    return !match || gameState.isAlive(match, playerId)
  }

  return {
    isAlive,
    startMatch,
    doTaskStep,
    doAttack,
    doCastSpell,
    doCallMeeting,
    doVote,
    doVent,
    doPlayerLeft,
    cancelTimers,
  }
}
