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
  // A human is mid-quiz; the server pauses bot simulation while any player
  // is (see AD-009).
  BUSY: 'busy',
}

const KNOWN_TYPES = new Set(Object.values(MESSAGE_TYPE))

export function isKnownMessageType(type) {
  return KNOWN_TYPES.has(type)
}
