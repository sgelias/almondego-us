import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createMatch,
  getRole,
  getAssignedTasks,
  completeTask,
  isAlive,
  recordDeath,
  checkWinCondition,
  startMeeting,
  endMeeting,
  castVote,
  tallyVotes,
} from './gameState.js'
import { TASK_LOCATIONS } from '../shared/taskPool.js'

// Deterministic seeded PRNG so tests never flake, without relying on Math.random.
function seededRandom(seed) {
  let state = seed
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff
    return state / 0x7fffffff
  }
}

function alwaysZero() {
  return 0
}

test('createMatch assigns exactly one impostor for 2 players', () => {
  const match = createMatch(['a', 'b'], alwaysZero)
  const roles = ['a', 'b'].map((id) => getRole(match, id))
  assert.equal(roles.filter((r) => r === 'impostor').length, 1)
  assert.equal(roles.filter((r) => r === 'crewmate').length, 1)
})

test('createMatch assigns exactly one impostor for 5 players', () => {
  const match = createMatch(['a', 'b', 'c', 'd', 'e'], seededRandom(42))
  const roles = ['a', 'b', 'c', 'd', 'e'].map((id) => getRole(match, id))
  assert.equal(roles.filter((r) => r === 'impostor').length, 1)
  assert.equal(roles.filter((r) => r === 'crewmate').length, 4)
})

test('each crewmate gets exactly 3 distinct valid task ids', () => {
  const match = createMatch(['a', 'b', 'c', 'd'], seededRandom(7))
  const validIds = new Set(TASK_LOCATIONS.map((t) => t.id))
  for (const id of ['a', 'b', 'c', 'd']) {
    if (getRole(match, id) === 'impostor') continue
    const tasks = getAssignedTasks(match, id)
    assert.equal(tasks.length, 3)
    assert.equal(new Set(tasks).size, 3)
    for (const taskId of tasks) assert.ok(validIds.has(taskId))
  }
})

test('the impostor has no assigned tasks', () => {
  const match = createMatch(['a', 'b'], alwaysZero)
  const impostorId = getRole(match, 'a') === 'impostor' ? 'a' : 'b'
  assert.deepEqual(getAssignedTasks(match, impostorId), [])
})

test('completeTask marks a task done and reports progress until all are done', () => {
  const match = createMatch(['a', 'b'], alwaysZero) // 'a' is impostor (index 0), 'b' is the only crewmate
  const crewId = getRole(match, 'a') === 'impostor' ? 'b' : 'a'
  const [t1, t2, t3] = getAssignedTasks(match, crewId)

  let progress = completeTask(match, crewId, t1)
  assert.equal(progress.allDone, false)
  assert.equal(progress.completed, 1)
  assert.equal(progress.total, 3)

  completeTask(match, crewId, t2)
  progress = completeTask(match, crewId, t3)
  assert.equal(progress.allDone, true)
  assert.equal(progress.completed, 3)
})

test('checkWinCondition returns null mid-game', () => {
  const match = createMatch(['a', 'b', 'c'], seededRandom(3))
  assert.equal(checkWinCondition(match), null)
})

test('with only 2 players, checkWinCondition is impostor-favored from the start (documents why the server requires 3+ to start)', () => {
  const match = createMatch(['a', 'b'], alwaysZero) // 1 impostor + 1 crewmate: living crew (1) <= living impostors (1)
  assert.equal(checkWinCondition(match), 'impostor')
})

test('checkWinCondition returns crew once every crewmate finishes all tasks', () => {
  const match = createMatch(['a', 'b'], alwaysZero)
  const crewId = getRole(match, 'a') === 'impostor' ? 'b' : 'a'
  for (const taskId of getAssignedTasks(match, crewId)) completeTask(match, crewId, taskId)
  assert.equal(checkWinCondition(match), 'crew')
})

test('checkWinCondition returns crew immediately once the impostor is no longer alive', () => {
  const match = createMatch(['a', 'b', 'c'], seededRandom(11))
  const impostorId = ['a', 'b', 'c'].find((id) => getRole(match, id) === 'impostor')
  recordDeath(match, impostorId)
  assert.equal(checkWinCondition(match), 'crew')
})

test('killing the one Crewmate still behind on tasks must not itself win the game for the crew (death is never task progress)', () => {
  const match = createMatch(['a', 'b', 'c', 'd'], seededRandom(11))
  const impostorId = ['a', 'b', 'c', 'd'].find((id) => getRole(match, id) === 'impostor')
  const crewIds = ['a', 'b', 'c', 'd'].filter((id) => id !== impostorId)
  const [laggard, ...onTime] = crewIds

  // Survivors finish everything first...
  for (const survivorId of onTime) {
    for (const taskId of getAssignedTasks(match, survivorId)) completeTask(match, survivorId, taskId)
  }
  // ...then the impostor kills the one Crewmate who never finished theirs.
  recordDeath(match, laggard)

  // The kill/ejection/disconnect path always checks with { checkTasks: false } -
  // a death must only ever be able to trigger the parity branch, never allDone.
  assert.notEqual(checkWinCondition(match, { checkTasks: false }), 'crew')
})

test('a dead crewmate\'s unfinished tasks are excluded from the win check (a Crewmate death must not make the task-win path unreachable)', () => {
  const match = createMatch(['a', 'b', 'c', 'd'], seededRandom(11))
  const impostorId = ['a', 'b', 'c', 'd'].find((id) => getRole(match, id) === 'impostor')
  const crewIds = ['a', 'b', 'c', 'd'].filter((id) => id !== impostorId)

  recordDeath(match, crewIds[0]) // dies with all 3 tasks still incomplete

  for (const survivorId of [crewIds[1], crewIds[2]]) {
    for (const taskId of getAssignedTasks(match, survivorId)) completeTask(match, survivorId, taskId)
  }

  assert.equal(checkWinCondition(match), 'crew')
})

test('checkWinCondition returns impostor once living crew drops to 1', () => {
  const match = createMatch(['a', 'b', 'c'], seededRandom(11))
  const impostorId = ['a', 'b', 'c'].find((id) => getRole(match, id) === 'impostor')
  const crewIds = ['a', 'b', 'c'].filter((id) => id !== impostorId)
  recordDeath(match, crewIds[0])
  assert.equal(checkWinCondition(match), 'impostor')
})

test('isAlive/recordDeath update the alive set', () => {
  const match = createMatch(['a', 'b'], alwaysZero)
  assert.equal(isAlive(match, 'a'), true)
  recordDeath(match, 'a')
  assert.equal(isAlive(match, 'a'), false)
  assert.equal(isAlive(match, 'b'), true)
})

test('startMeeting/endMeeting toggle phase and reset votes', () => {
  const match = createMatch(['a', 'b', 'c'], seededRandom(2))
  startMeeting(match)
  assert.equal(match.phase, 'meeting')
  castVote(match, 'a', 'b')
  endMeeting(match)
  assert.equal(match.phase, 'playing')
  startMeeting(match)
  assert.equal(match.votes.size, 0)
})

test('tallyVotes ejects the player with a clear plurality', () => {
  const match = createMatch(['a', 'b', 'c'], seededRandom(5))
  const impostorId = ['a', 'b', 'c'].find((id) => getRole(match, id) === 'impostor')
  startMeeting(match)
  castVote(match, 'a', 'b')
  castVote(match, 'b', 'b')
  castVote(match, 'c', 'a')
  const result = tallyVotes(match)
  assert.equal(result.ejectedId, 'b')
  assert.equal(result.wasImpostor, impostorId === 'b')
})

test('tallyVotes ejects no one on a tie', () => {
  const match = createMatch(['a', 'b'], alwaysZero)
  startMeeting(match)
  castVote(match, 'a', 'a')
  castVote(match, 'b', 'b')
  const result = tallyVotes(match)
  assert.equal(result.ejectedId, null)
})

test('tallyVotes ejects no one when skip has a plurality', () => {
  const match = createMatch(['a', 'b', 'c'], seededRandom(9))
  startMeeting(match)
  castVote(match, 'a', 'skip')
  castVote(match, 'b', 'skip')
  castVote(match, 'c', 'a')
  const result = tallyVotes(match)
  assert.equal(result.ejectedId, null)
})

test('castVote overwrites a voter\'s earlier vote (last vote wins)', () => {
  const match = createMatch(['a', 'b'], alwaysZero)
  startMeeting(match)
  castVote(match, 'a', 'a')
  castVote(match, 'a', 'b')
  castVote(match, 'b', 'b')
  const result = tallyVotes(match)
  assert.equal(result.ejectedId, 'b')
})
