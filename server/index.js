import { WebSocketServer, WebSocket } from 'ws'
import { networkInterfaces } from 'node:os'
import { randomUUID } from 'node:crypto'
import { MESSAGE_TYPE, isKnownMessageType } from '../shared/protocol.js'

const PORT = process.env.PORT || 8080

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

const players = new Map()
let hostId = null

const wss = new WebSocketServer({ port: PORT })

function send(socket, type, payload) {
  if (socket.readyState === WebSocket.OPEN) {
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
      broadcastToAll(MESSAGE_TYPE.START, {})
    }
  })

  socket.on('close', () => {
    if (!socket.playerId) return
    players.delete(socket.playerId)
    broadcastToAll(MESSAGE_TYPE.PLAYER_LEFT, { id: socket.playerId })
    if (socket.playerId === hostId) hostId = null
  })
})

console.log(`Among Us: First Person relay server listening at ws://${getLanAddress()}:${PORT}`)
console.log(`Host: open the game and click "Host & Join". Others: use the address above.`)
