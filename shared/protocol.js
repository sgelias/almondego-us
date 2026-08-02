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
  // Server -> the acting player: which step of a task they just advanced to.
  TASK_STEP: 'taskStep',
  // An attack, not a kill: it takes MAX_HEALTH hits to bring someone down.
  ATTACK: 'attack',
  CALL_MEETING: 'callMeeting',
  VOTE: 'vote',
  VENT: 'vent',
  TASKS_PROGRESS: 'tasksProgress',
  CAST_SPELL: 'castSpell',
  SPELL_CAST: 'spellCast',
  PLAYER_HURT: 'playerHurt',
  PLAYER_DIED: 'playerDied',
  MEETING_STARTED: 'meetingStarted',
  MEETING_RESULT: 'meetingResult',
  GAME_OVER: 'gameOver',
  // A human is mid-quiz; the server pauses bot simulation while any player
  // is (see AD-009).
  BUSY: 'busy',
  // Ship emergencies.
  EVENT_STARTED: 'eventStarted',
  EVENT_PANEL: 'eventPanel',
  EVENT_ENDED: 'eventEnded',
  ARM_PANEL: 'armPanel',
  // The host's lobby notice board: instructions sent to everyone waiting.
  LOBBY_NOTICE: 'lobbyNotice',
}

const KNOWN_TYPES = new Set(Object.values(MESSAGE_TYPE))

export function isKnownMessageType(type) {
  return KNOWN_TYPES.has(type)
}
