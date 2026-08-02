// The host's notice board: short messages sent to everyone in the lobby
// before a match starts ("façam as tarefas da Elétrica primeiro", house
// rules, who is playing on whose account).
//
// This is a genuine trust boundary - free text typed by one player, stored on
// the server, and rendered on every other player's screen - so the rules for
// what survives live here, next to their tests, rather than inline in a
// socket handler.

export const MAX_NOTICE_LENGTH = 240
// Enough that nobody loses an instruction mid-lobby, bounded so a host
// holding down a key cannot grow the server's memory without limit.
export const MAX_NOTICE_HISTORY = 30

// Returns the text to publish, or null if there is nothing worth sending.
export function sanitizeNoticeText(raw) {
  if (typeof raw !== 'string') return null
  // Control characters would let a notice mangle the layout of everyone
  // else's board. Newlines are kept: an instruction list is a fair use of
  // this box.
  const cleaned = raw
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '')
    .trim()
  if (cleaned.length === 0) return null
  return cleaned.slice(0, MAX_NOTICE_LENGTH)
}

// Appends in place and drops the oldest past the cap.
export function pushNotice(notices, notice) {
  notices.push(notice)
  while (notices.length > MAX_NOTICE_HISTORY) notices.shift()
  return notices
}

// The two rules that decide whether a notice may be published at all. They
// live here, with a test, rather than as bare conditions inside a socket
// switch: this repo has twice shipped a guard that failed open in silence
// (L-011, L-018), and both of these fail open the same way if they break -
// a guest posting to everyone, or a briefing channel staying open during a
// match and bypassing the vision rules the game is built on.
// Both flags must be exactly the boolean that permits posting. `!== true`
// would read a truthy non-boolean (a match object passed where a flag was
// meant) as "no match in progress" and open the board mid-game - the precise
// shape of failing open this function exists to prevent.
export function canPostNotice({ isHost, matchInProgress }) {
  return isHost === true && matchInProgress === false
}
