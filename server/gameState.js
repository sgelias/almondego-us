import { TASK_LOCATIONS } from '../shared/taskPool.js'

const TASKS_PER_CREWMATE = 3

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

export function createMatch(playerIds, randomFn) {
  const impostorIndex = Math.floor(randomFn() * playerIds.length)
  const impostorId = playerIds[impostorIndex]

  const tasksByPlayer = new Map()
  const taskIds = TASK_LOCATIONS.map((task) => task.id)
  for (const playerId of playerIds) {
    if (playerId === impostorId) continue
    const assigned = pickRandomSubset(taskIds, TASKS_PER_CREWMATE, randomFn)
    tasksByPlayer.set(playerId, assigned.map((taskId) => ({ taskId, done: false })))
  }

  return {
    impostorId,
    alive: new Set(playerIds),
    tasksByPlayer,
    phase: 'playing',
    votes: new Map(),
  }
}

export function getRole(match, playerId) {
  return playerId === match.impostorId ? 'impostor' : 'crewmate'
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
  if (!match.alive.has(match.impostorId)) return 'crew'

  if (checkTasks) {
    const { allDone } = tasksSummary(match)
    if (allDone) return 'crew'
  }

  const livingCrewCount = match.alive.size - 1
  if (livingCrewCount <= 1) return 'impostor'

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
  return { ejectedId, wasImpostor: ejectedId !== null && ejectedId === match.impostorId }
}
