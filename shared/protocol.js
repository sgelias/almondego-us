export const MESSAGE_TYPE = {
  JOIN: 'join',
  WELCOME: 'welcome',
  PLAYER_JOINED: 'playerJoined',
  PLAYER_LEFT: 'playerLeft',
  STATE: 'state',
  START: 'start',
  ERROR: 'error',

  ROLE: 'role',
  TELEPORT: 'teleport',
  TASK_COMPLETE: 'taskComplete',
  KILL: 'kill',
  CALL_MEETING: 'callMeeting',
  VOTE: 'vote',
  VENT: 'vent',
  TASKS_PROGRESS: 'tasksProgress',
  PLAYER_DIED: 'playerDied',
  MEETING_STARTED: 'meetingStarted',
  MEETING_RESULT: 'meetingResult',
  GAME_OVER: 'gameOver',
}

const KNOWN_TYPES = new Set(Object.values(MESSAGE_TYPE))

export function isKnownMessageType(type) {
  return KNOWN_TYPES.has(type)
}
