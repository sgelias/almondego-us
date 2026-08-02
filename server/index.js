import { WebSocketServer, WebSocket } from 'ws'
import { networkInterfaces } from 'node:os'
import { randomUUID } from 'node:crypto'
import { MESSAGE_TYPE, isKnownMessageType } from '../shared/protocol.js'
import { ROOM_LAYOUT } from '../shared/skeldRooms.js'
import { createGameActions } from './gameActions.js'
import { createBotRunner } from './botRunner.js'

const PORT = process.env.PORT || 8080
// 1, not 3: empty slots are filled with bots up to TARGET_PLAYER_COUNT, so a
// solo player still gets a full, playable match. This supersedes
// core-game-loop's GAME-15 (which required 3 humans to avoid the impostor
// starting at parity) - a 6-player match is never at parity on kickoff.
const MIN_PLAYERS_TO_START = 1
const TARGET_PLAYER_COUNT = 6
// With N impostors, parity is reached at N crew vs N impostors, so crew must
// start strictly ahead: at most floor((total-1)/2) impostors. For 6 players
// that is 2.
const maxImpostors = (total) => Math.max(1, Math.floor((total - 1) / 2))

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
  const name = requestedName || 'Jogador'
  const existingNames = new Set([...players.values()].map((p) => p.name))
  if (!existingNames.has(name)) return name
  let suffix = 2
  while (existingNames.has(`${name} (${suffix})`)) suffix += 1
  return `${name} (${suffix})`
}

// Size of the crewmate palette in src/net/playerAvatar.js.
const COLOR_COUNT = 12

// Assigned here, next to name resolution, for the same reason names are:
// only the server sees every player, so only the server can guarantee no two
// of them collide. Clients just render the index they are told.
function resolveColorIndex(players) {
  const taken = new Set([...players.values()].map((p) => p.colorIndex))
  for (let i = 0; i < COLOR_COUNT; i += 1) {
    if (!taken.has(i)) return i
  }
  return taken.size % COLOR_COUNT
}

function spawnPoint() {
  const cafeteria = ROOM_LAYOUT.find((room) => room.id === 'cafeteria')
  return [cafeteria.center[0], 1.35, cafeteria.center[2]]
}

const players = new Map()
const socketsByPlayerId = new Map()
// Latest reported position per human, so bot sensing can see real players
// the same way it sees other bots.
const humanPositions = new Map()
let hostId = null
let match = null
// Players currently answering a task question. Bot simulation is paused
// while this is non-empty (AD-009).
const busyPlayers = new Set()

function syncBotPause() {
  botRunner?.setPaused(busyPlayers.size > 0)
}

const wss = new WebSocketServer({ port: PORT })

function send(socket, type, payload) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type, ...payload }))
  }
}

function sendToPlayer(playerId, type, payload) {
  // A bot has no socket; its own actions are applied directly by botRunner,
  // so there is nothing to deliver.
  send(socketsByPlayerId.get(playerId), type, payload)
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

// botRunner and gameActions are mutually dependent (bots invoke actions;
// actions notify bots of witnessable events), so the hooks resolve the
// runner lazily rather than at construction time.
let botRunner = null

const gameActions = createGameActions({
  getMatch: () => match,
  setMatch: (next) => {
    match = next
  },
  getPlayers: () => players,
  broadcastToAll,
  sendToPlayer,
  hooks: {
    onAttack: (attackerId, victimId, died) => botRunner?.hooks.onAttack(attackerId, victimId, died),
    onSpellCast: (playerId, spellId, position) => botRunner?.hooks.onSpellCast(playerId, spellId, position),
    onVent: (playerId) => botRunner?.hooks.onVent(playerId),
    onMeetingStarted: (info) => botRunner?.hooks.onMeetingStarted(info),
    onMeetingEnded: () => botRunner?.hooks.onMeetingEnded(),
    onGameOver: () => botRunner?.hooks.onGameOver(),
  },
})

botRunner = createBotRunner({
  gameActions,
  getMatch: () => match,
  getPlayers: () => players,
  getHumanPositions: () => humanPositions,
  broadcastState: (id, position, rotationY, seq) => {
    broadcastToAll(MESSAGE_TYPE.STATE, { id, position, rotationY, seq })
  },
})

// Teleports every living player to a random room. Humans are told where to
// go; bots are moved directly, because they have no client to obey a
// teleport message.
function shuffleEveryone() {
  const rooms = ROOM_LAYOUT
  for (const playerId of players.keys()) {
    if (!gameActions.isAlive(playerId)) continue
    const room = rooms[Math.floor(Math.random() * rooms.length)]
    const position = [room.center[0], 1.35, room.center[2]]
    if (botRunner.isBot(playerId)) botRunner.teleportBot(playerId, position)
    else sendToPlayer(playerId, MESSAGE_TYPE.TELEPORT, { position })
  }
}

function startMatch(socket, requestedImpostors) {
  if (socket.playerId !== hostId) return
  gameActions.cancelTimers()
  botRunner.stop()

  // Drop any bots left over from a previous match before counting humans.
  // Broadcasting the removal matters for "play again": without it every
  // client keeps last round's bots in its roster forever and the list grows
  // by five each restart.
  for (const [id, player] of [...players]) {
    if (!player.isBot) continue
    players.delete(id)
    broadcastToAll(MESSAGE_TYPE.PLAYER_LEFT, { id })
  }

  if (players.size < MIN_PLAYERS_TO_START) {
    send(socket, MESSAGE_TYPE.ERROR, { message: 'É necessário pelo menos 1 jogador para iniciar.' })
    return
  }

  const humanNames = [...players.values()].map((player) => player.name)
  const botsNeeded = Math.max(0, TARGET_PLAYER_COUNT - players.size)
  const createdBots = botRunner.spawnBots(botsNeeded, humanNames, spawnPoint())

  // Announced as ordinary joins so every client's roster, name labels, and
  // remote-avatar rendering treat bots exactly like humans (BOT-03).
  for (const { id, name } of createdBots) {
    const colorIndex = resolveColorIndex(players)
    players.set(id, { name, colorIndex, isBot: true })
    broadcastToAll(MESSAGE_TYPE.PLAYER_JOINED, { id, name, colorIndex })
  }

  busyPlayers.clear()
  const impostorCount = Math.min(
    Math.max(1, Number(requestedImpostors) || 1),
    maxImpostors(players.size)
  )
  broadcastToAll(MESSAGE_TYPE.START, {})
  gameActions.startMatch([...players.keys()], { impostorCount })
  botRunner.start()
  syncBotPause()
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

    switch (message.type) {
      case MESSAGE_TYPE.JOIN: {
        const id = randomUUID()
        const name = resolveName(message.name, players)
        const colorIndex = resolveColorIndex(players)
        const isHost = hostId === null
        if (isHost) hostId = id

        players.set(id, { name, colorIndex })
        socketsByPlayerId.set(id, socket)
        socket.playerId = id

        send(socket, MESSAGE_TYPE.WELCOME, {
          playerId: id,
          isHost,
          players: [...players.entries()].map(([playerId, player]) => ({
            id: playerId,
            name: player.name,
            colorIndex: player.colorIndex,
          })),
        })
        broadcastToOthers(socket, MESSAGE_TYPE.PLAYER_JOINED, { id, name, colorIndex })
        return
      }

      case MESSAGE_TYPE.STATE: {
        if (!socket.playerId) return
        humanPositions.set(socket.playerId, message.position)
        if (match && !gameActions.isAlive(socket.playerId)) return
        broadcastToOthers(socket, MESSAGE_TYPE.STATE, {
          id: socket.playerId,
          position: message.position,
          rotationY: message.rotationY,
          seq: message.seq,
        })
        return
      }

      case MESSAGE_TYPE.START:
        startMatch(socket, message.impostorCount)
        return

      case MESSAGE_TYPE.TASK_COMPLETE:
        gameActions.doTaskComplete(socket.playerId, message.taskId)
        return

      case MESSAGE_TYPE.CAST_SPELL: {
        const spellId = gameActions.doCastSpell(socket.playerId, message.position)
        // "Embaralhar" is the one spell the server has to carry out itself:
        // it moves every living player, and only the server knows where the
        // bots are.
        if (spellId === 'embaralhar') shuffleEveryone()
        return
      }

      case MESSAGE_TYPE.ATTACK:
        gameActions.doAttack(socket.playerId, message.targetId)
        return

      case MESSAGE_TYPE.CALL_MEETING:
        gameActions.doCallMeeting(socket.playerId)
        return

      case MESSAGE_TYPE.VOTE:
        gameActions.doVote(socket.playerId, message.targetId)
        return

      case MESSAGE_TYPE.VENT:
        gameActions.doVent(socket.playerId, message.ventId)
        return

      case MESSAGE_TYPE.BUSY: {
        if (!socket.playerId) return
        if (message.busy) busyPlayers.add(socket.playerId)
        else busyPlayers.delete(socket.playerId)
        syncBotPause()
        return
      }

      default:
        return
    }
  })

  socket.on('close', () => {
    if (!socket.playerId) return
    const playerId = socket.playerId

    players.delete(playerId)
    socketsByPlayerId.delete(playerId)
    humanPositions.delete(playerId)
    // A player who disconnects mid-question must not leave the bots frozen.
    busyPlayers.delete(playerId)
    syncBotPause()
    broadcastToAll(MESSAGE_TYPE.PLAYER_LEFT, { id: playerId })
    if (playerId === hostId) hostId = null

    gameActions.doPlayerLeft(playerId)
  })
})

console.log(`AlmondegoUs — servidor de partida ouvindo em ws://${getLanAddress()}:${PORT}`)
console.log(`Anfitrião: abra o jogo e clique em "Hospedar e Entrar". Os outros: usem o endereço acima.`)
