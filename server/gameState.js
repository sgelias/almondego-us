import { TASK_LOCATIONS } from '../shared/taskPool.js'

const TASKS_PER_CREWMATE = 3

// Hits needed to kill. The original one-touch kill made deaths feel
// arbitrary - the impostor only had to brush past you. Three hits give the
// victim time to notice, react and run.
export const MAX_HEALTH = 3

function pickRandomSubset(items, count, randomFn) {
  const pool = [...items]
  for (let i = 0; i < count; i += 1) {
    const j = i + Math.floor(randomFn() * (pool.length - i))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, count)
}

// Only living Crewmates' tasks count, so a dead Crewmate's unfinished tasks
// don't stay in the denominator forever (the server rejects taskComplete
// from the dead - see completeTask/isAlive - so nothing could ever move
// them to completed). checkWinCondition below only consults this from the
// TASK_COMPLETE path, specifically so a kill/ejection/disconnect can never
// shrink the denominator into an unearned win by removing a laggard from
// consideration (see STATE.md L-011) - it must stay possible for a task
// win to become reachable again after a death, without a death itself ever
// being treated as task progress.
function tasksSummary(match) {
  let completed = 0
  let total = 0
  for (const [playerId, tasks] of match.tasksByPlayer) {
    if (!match.alive.has(playerId)) continue
    total += tasks.length
    completed += tasks.filter((task) => task.done).length
  }
  return { completed, total, allDone: total > 0 && completed === total }
}

export function createMatch(playerIds, randomFn, { impostorCount = 1 } = {}) {
  const count = Math.max(1, Math.min(impostorCount, playerIds.length - 1))
  const impostorIds = new Set(pickRandomSubset(playerIds, count, randomFn))

  const tasksByPlayer = new Map()
  const taskIds = TASK_LOCATIONS.map((task) => task.id)
  for (const playerId of playerIds) {
    if (impostorIds.has(playerId)) continue
    const assigned = pickRandomSubset(taskIds, TASKS_PER_CREWMATE, randomFn)
    tasksByPlayer.set(playerId, assigned.map((taskId) => ({ taskId, done: false })))
  }

  return {
    impostorIds,
    alive: new Set(playerIds),
    health: new Map(playerIds.map((id) => [id, MAX_HEALTH])),
    tasksByPlayer,
    phase: 'playing',
    votes: new Map(),
  }
}

export function getImpostorIds(match) {
  return [...match.impostorIds]
}

export function getHealth(match, playerId) {
  return match.health.get(playerId) ?? 0
}

// The only place health goes down. recordDeath remains the single transition
// out of `alive`, so ejection and disconnect keep working untouched and
// checkWinCondition still reads `alive` alone rather than inferring life
// from health - two sources of truth about who is alive is how the win
// conditions went wrong before (L-009/L-011).
export function damage(match, playerId) {
  if (!match.alive.has(playerId)) return { health: getHealth(match, playerId), died: false }
  const health = Math.max(0, getHealth(match, playerId) - 1)
  match.health.set(playerId, health)
  if (health > 0) return { health, died: false }
  recordDeath(match, playerId)
  return { health: 0, died: true }
}

export function getRole(match, playerId) {
  return match.impostorIds.has(playerId) ? 'impostor' : 'crewmate'
}

export function getAssignedTasks(match, playerId) {
  const tasks = match.tasksByPlayer.get(playerId)
  return tasks ? tasks.map((task) => task.taskId) : []
}

export function completeTask(match, playerId, taskId) {
  const tasks = match.tasksByPlayer.get(playerId)
  const entry = tasks?.find((task) => task.taskId === taskId)
  if (entry) entry.done = true
  return tasksSummary(match)
}

export function isAlive(match, playerId) {
  return match.alive.has(playerId)
}

// SPEC_DEVIATION: design.md listed recordDeath(match, playerId, cause), but
// gameState never used `cause` internally - the caller already knows why
// it's recording a death and builds the broadcast message itself.
export function recordDeath(match, playerId) {
  match.alive.delete(playerId)
}

// checkTasks defaults to true (used after an actual TASK_COMPLETE) but the
// kill/ejection/disconnect paths in server/index.js pass false: a death
// must only ever be able to trigger the parity/impostor-alive branches
// below, never the allDone branch - otherwise killing (or disconnecting)
// the one Crewmate still behind on tasks would hand the crew a win they
// never actually finished (see STATE.md L-011).
export function checkWinCondition(match, { checkTasks = true } = {}) {
  // "No impostor left alive", not "the impostor is dead" - with two
  // impostors the latter fires the moment either one is ejected.
  let livingImpostors = 0
  for (const id of match.impostorIds) {
    if (match.alive.has(id)) livingImpostors += 1
  }
  if (livingImpostors === 0) return 'crew'

  if (checkTasks) {
    const { allDone } = tasksSummary(match)
    if (allDone) return 'crew'
  }

  const livingCrewCount = match.alive.size - livingImpostors
  if (livingCrewCount <= livingImpostors) return 'impostor'

  return null
}

export function startMeeting(match) {
  match.phase = 'meeting'
  match.votes = new Map()
}

export function endMeeting(match) {
  match.phase = 'playing'
  match.votes = new Map()
}

export function castVote(match, voterId, targetId) {
  match.votes.set(voterId, targetId)
}

export function tallyVotes(match) {
  const tally = new Map()
  for (const targetId of match.votes.values()) {
    tally.set(targetId, (tally.get(targetId) ?? 0) + 1)
  }

  let topTarget = null
  let topCount = 0
  let tied = false
  for (const [target, count] of tally) {
    if (count > topCount) {
      topTarget = target
      topCount = count
      tied = false
    } else if (count === topCount) {
      tied = true
    }
  }

  const ejectedId = !tied && topTarget !== 'skip' && topCount > 0 ? topTarget : null
  return { ejectedId, wasImpostor: ejectedId !== null && match.impostorIds.has(ejectedId) }
}
