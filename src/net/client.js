import { isKnownMessageType } from '../../shared/protocol.js'

export const CONNECTION_ERROR = '_connectionError'

export function createNetClient(url) {
  const socket = new WebSocket(url)
  const handlers = new Map()
  let hasOpened = false

  function emit(type, payload) {
    const handler = handlers.get(type)
    if (handler) handler(payload)
  }

  socket.addEventListener('open', () => {
    hasOpened = true
  })

  socket.addEventListener('message', (event) => {
    let message
    try {
      message = JSON.parse(event.data)
    } catch {
      return
    }
    if (!isKnownMessageType(message.type)) return
    emit(message.type, message)
  })

  socket.addEventListener('error', () => {
    if (!hasOpened) emit(CONNECTION_ERROR, { message: 'Could not reach the host.' })
  })

  socket.addEventListener('close', () => {
    if (!hasOpened) emit(CONNECTION_ERROR, { message: 'Could not reach the host.' })
  })

  return {
    on(type, handler) {
      handlers.set(type, handler)
    },
    send(type, payload) {
      socket.send(JSON.stringify({ type, ...payload }))
    },
    close() {
      socket.close()
    },
  }
}
