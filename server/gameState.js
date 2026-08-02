import { TASK_LOCATIONS, stepCount } from '../shared/taskPool.js'
import { pickSpell } from '../shared/spellPool.js'

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
  // One spell per crewmate, rolled independently - impostors get none, so
  // casting is itself a claim of innocence.
  const spellByPlayer = new Map()
  const taskIds = TASK_LOCATIONS.map((task) => task.id)
  for (const playerId of playerIds) {
    if (impostorIds.has(playerId)) continue
    const assigned = pickRandomSubset(taskIds, TASKS_PER_CREWMATE, randomFn)
    tasksByPlayer.set(playerId, assigned.map((taskId) => ({ taskId, done: false, step: 0 })))
    spellByPlayer.set(playerId, pickSpell(randomFn))
  }

  return {
    impostorIds,
    alive: new Set(playerIds),
    health: new Map(playerIds.map((id) => [id, MAX_HEALTH])),
    tasksByPlayer,
    spellByPlayer,
    spellsSpent: new Set(),
    phase: 'playing',
    votes: new Map(),
  }
}

export function getSpell(match, playerId) {
  return match.spellByPlayer.get(playerId) ?? null
}

export function canUseSpell(match, playerId) {
  if (!match.alive.has(playerId)) return false
  if (match.spellsSpent.has(playerId)) return false
  return match.spellByPlayer.has(playerId)
}

// Returns false rather than throwing on a second attempt: the client can
// always be a frame behind, and a refused cast is a normal outcome.
export function useSpell(match, playerId) {
  if (!canUseSpell(match, playerId)) return false
  match.spellsSpent.add(playerId)
  return true
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

// How far a player has got through a task's steps. Progress is per player,
// not per task: two crewmates can be carrying the same kind of fuse at once.
export function currentStep(match, playerId, taskId) {
  const entry = match.tasksByPlayer.get(playerId)?.find((task) => task.taskId === taskId)
  if (!entry) return null
  return entry.done ? stepCount(taskId) : (entry.step ?? 0)
}

// Advances one step. Returns { step, completed }: `step` is null when the
// advance was refused (not your task, or already finished), so a caller can
// tell "you moved forward" from "nothing happened" rather than guessing.
export function advanceTaskStep(match, playerId, taskId) {
  const entry = match.tasksByPlayer.get(playerId)?.find((task) => task.taskId === taskId)
  if (!entry || entry.done) return { step: null, completed: false }

  entry.step = (entry.step ?? 0) + 1
  if (entry.step < stepCount(taskId)) return { step: entry.step, completed: false }

  entry.done = true
  return { step: entry.step, completed: true }
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
