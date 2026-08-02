export const MESSAGE_TYPE = {
  JOIN: 'join',
  WELCOME: 'welcome',
  PLAYER_JOINED: 'playerJoined',
  PLAYER_LEFT: 'playerLeft',
  STATE: 'state',
  START: 'start',
  ERROR: 'error',
}

const KNOWN_TYPES = new Set(Object.values(MESSAGE_TYPE))

export function isKnownMessageType(type) {
  return KNOWN_TYPES.has(type)
}
