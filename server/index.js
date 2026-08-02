import { WebSocketServer, WebSocket } from 'ws'
import { networkInterfaces } from 'node:os'
import { randomUUID } from 'node:crypto'
import { MESSAGE_TYPE, isKnownMessageType } from '../shared/protocol.js'
import { ROOM_LAYOUT } from '../src/map/skeldRooms.js'
import { VENT_LOCATIONS, getVentDestination } from '../shared/ventPool.js'
import * as gameState from './gameState.js'

const PORT = process.env.PORT || 8080
// 3, not 2: with exactly 1 impostor, a 2-player match (1 crew) starts with
// living crew == living impostors, which trivially satisfies the impostor
// parity-win condition before anything happens. 3 players (1 impostor +
// 2 crew) keeps crew strictly ahead until an actual kill occurs.
const MIN_PLAYERS_TO_START = 3
const DISCUSSION_SECONDS = 15
const VOTING_SECONDS = 20
// Matches playerController's settled eye height (capsule radius + half its
// segment height) so a teleported player doesn't visibly pop up/down.
const TELEPORT_EYE_HEIGHT = 1.35

function getLanAddress() {
  const interfaces = networkInterfaces()
  for (const ifaceList of Object.values(interfaces)) {
    for (const iface of ifaceList) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address
    }
  }
  return '127.0.0.1'
}

function resolveName(requestedName, players) {
  const name = requestedName || 'Player'
  const existingNames = new Set([...players.values()].map((p) => p.name))
  if (!existingNames.has(name)) return name
  let suffix = 2
  while (existingNames.has(`${name} (${suffix})`)) suffix += 1
  return `${name} (${suffix})`
}

function ventPosition(ventId) {
  const vent = VENT_LOCATIONS.find((v) => v.id === ventId)
  const room = ROOM_LAYOUT.find((r) => r.id === vent.roomId)
  return [room.center[0] + vent.offset[0], TELEPORT_EYE_HEIGHT, room.center[2] + vent.offset[2]]
}

const players = new Map()
const socketsByPlayerId = new Map()
let hostId = null
let match = null
let meetingTimer = null

const wss = new WebSocketServer({ port: PORT })

function send(socket, type, payload) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type, ...payload }))
  }
}

function broadcastToOthers(senderSocket, type, payload) {
  for (const client of wss.clients) {
    if (client !== senderSocket) send(client, type, payload)
  }
}

function broadcastToAll(type, payload) {
  for (const client of wss.clients) {
    send(client, type, payload)
  }
}

function checkAndBroadcastWin() {
  if (!match) return
  const winner = gameState.checkWinCondition(match)
  if (!winner) return
  match.phase = 'gameOver'
  broadcastToAll(MESSAGE_TYPE.GAME_OVER, { winner, impostorId: match.impostorId })
}

function finishMeeting() {
  if (meetingTimer) {
    clearTimeout(meetingTimer)
    meetingTimer = null
  }
  const { ejectedId, wasImpostor } = gameState.tallyVotes(match)
  if (ejectedId) gameState.recordDeath(match, ejectedId)
  gameState.endMeeting(match)
  broadcastToAll(MESSAGE_TYPE.MEETING_RESULT, { ejectedId, wasImpostor })
  checkAndBroadcastWin()
}

wss.on('connection', (socket) => {
  socket.on('message', (data) => {
    let message
    try {
      message = JSON.parse(data.toString())
    } catch {
      return
    }
    if (!isKnownMessageType(message.type)) return

    if (message.type === MESSAGE_TYPE.JOIN) {
      const id = randomUUID()
      const name = resolveName(message.name, players)
      const isHost = hostId === null
      if (isHost) hostId = id

      players.set(id, { name })
      socketsByPlayerId.set(id, socket)
      socket.playerId = id

      send(socket, MESSAGE_TYPE.WELCOME, {
        playerId: id,
        isHost,
        players: [...players.entries()].map(([playerId, player]) => ({ id: playerId, name: player.name })),
      })
      broadcastToOthers(socket, MESSAGE_TYPE.PLAYER_JOINED, { id, name })
      return
    }

    if (message.type === MESSAGE_TYPE.STATE) {
      if (!socket.playerId) return
      if (match && !gameState.isAlive(match, socket.playerId)) return
      broadcastToOthers(socket, MESSAGE_TYPE.STATE, {
        id: socket.playerId,
        position: message.position,
        rotationY: message.rotationY,
        seq: message.seq,
      })
      return
    }

    if (message.type === MESSAGE_TYPE.START) {
      if (socket.playerId !== hostId) return
      if (players.size < MIN_PLAYERS_TO_START) {
        send(socket, MESSAGE_TYPE.ERROR, { message: 'Need at least 3 players to start.' })
        return
      }
      broadcastToAll(MESSAGE_TYPE.START, {})

      const playerIds = [...players.keys()]
      match = gameState.createMatch(playerIds, Math.random)
      for (const playerId of playerIds) {
        send(socketsByPlayerId.get(playerId), MESSAGE_TYPE.ROLE, {
          role: gameState.getRole(match, playerId),
          taskIds: gameState.getAssignedTasks(match, playerId),
        })
      }
      return
    }

    if (message.type === MESSAGE_TYPE.TASK_COMPLETE) {
      if (!match || match.phase !== 'playing') return
      const playerId = socket.playerId
      if (!playerId || !gameState.isAlive(match, playerId)) return
      if (gameState.getRole(match, playerId) !== 'crewmate') return
      if (!gameState.getAssignedTasks(match, playerId).includes(message.taskId)) return

      const progress = gameState.completeTask(match, playerId, message.taskId)
      broadcastToAll(MESSAGE_TYPE.TASKS_PROGRESS, { completed: progress.completed, total: progress.total })
      checkAndBroadcastWin()
      return
    }

    if (message.type === MESSAGE_TYPE.KILL) {
      if (!match || match.phase !== 'playing') return
      const playerId = socket.playerId
      if (!playerId || gameState.getRole(match, playerId) !== 'impostor') return
      if (!gameState.isAlive(match, playerId)) return
      const targetId = message.targetId
      if (targetId === playerId || !gameState.isAlive(match, targetId)) return

      gameState.recordDeath(match, targetId)
      broadcastToAll(MESSAGE_TYPE.PLAYER_DIED, { id: targetId, cause: 'killed' })
      checkAndBroadcastWin()
      return
    }

    if (message.type === MESSAGE_TYPE.CALL_MEETING) {
      if (!match || match.phase !== 'playing') return
      const playerId = socket.playerId
      if (!playerId || !gameState.isAlive(match, playerId)) return

      gameState.startMeeting(match)
      const livingPlayers = [...match.alive].map((id) => ({ id, name: players.get(id).name }))
      broadcastToAll(MESSAGE_TYPE.MEETING_STARTED, {
        livingPlayers,
        discussionSeconds: DISCUSSION_SECONDS,
        votingSeconds: VOTING_SECONDS,
      })
      meetingTimer = setTimeout(finishMeeting, (DISCUSSION_SECONDS + VOTING_SECONDS) * 1000)
      return
    }

    if (message.type === MESSAGE_TYPE.VOTE) {
      if (!match || match.phase !== 'meeting') return
      const playerId = socket.playerId
      if (!playerId || !gameState.isAlive(match, playerId)) return
      const targetId = message.targetId
      if (targetId !== 'skip' && !gameState.isAlive(match, targetId)) return

      gameState.castVote(match, playerId, targetId)
      if (match.votes.size >= match.alive.size) finishMeeting()
      return
    }

    if (message.type === MESSAGE_TYPE.VENT) {
      if (!match || match.phase !== 'playing') return
      const playerId = socket.playerId
      if (!playerId || gameState.getRole(match, playerId) !== 'impostor') return
      if (!gameState.isAlive(match, playerId)) return

      const destinationVentId = getVentDestination(message.ventId)
      if (!destinationVentId) return
      send(socket, MESSAGE_TYPE.TELEPORT, { position: ventPosition(destinationVentId) })
    }
  })

  socket.on('close', () => {
    if (!socket.playerId) return
    const playerId = socket.playerId

    players.delete(playerId)
    socketsByPlayerId.delete(playerId)
    broadcastToAll(MESSAGE_TYPE.PLAYER_LEFT, { id: playerId })
    if (playerId === hostId) hostId = null

    if (match && gameState.isAlive(match, playerId)) {
      if (playerId === match.impostorId) {
        match.phase = 'gameOver'
        broadcastToAll(MESSAGE_TYPE.GAME_OVER, { winner: 'crew', impostorId: match.impostorId })
      } else {
        gameState.recordDeath(match, playerId)
        checkAndBroadcastWin()
      }
    }
  })
})

console.log(`Among Us: First Person relay server listening at ws://${getLanAddress()}:${PORT}`)
console.log(`Host: open the game and click "Host & Join". Others: use the address above.`)
