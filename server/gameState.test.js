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
  damage,
  getHealth,
  getImpostorIds,
  MAX_HEALTH,
  canUseSpell,
  useSpell,
  getSpell,
  advanceTaskStep,
  currentStep,
} from './gameState.js'
import { TASK_LOCATIONS, stepCount } from '../shared/taskPool.js'
import { SPELLS } from '../shared/spellPool.js'

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

// --- multiple impostors + health (new dynamic) ---

test('createMatch assigns the requested number of impostors', () => {
  for (const count of [1, 2, 3]) {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f']
    const match = createMatch(ids, seededRandom(count * 13), { impostorCount: count })
    const impostors = ids.filter((id) => getRole(match, id) === 'impostor')
    assert.equal(impostors.length, count, `asked for ${count} impostors, got ${impostors.length}`)
  }
})

test('createMatch defaults to a single impostor', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f']
  const match = createMatch(ids, seededRandom(5))
  assert.equal(ids.filter((id) => getRole(match, id) === 'impostor').length, 1)
})

test('impostors get no tasks regardless of how many there are', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f']
  const match = createMatch(ids, seededRandom(9), { impostorCount: 2 })
  for (const id of ids) {
    if (getRole(match, id) !== 'impostor') continue
    assert.deepEqual(getAssignedTasks(match, id), [])
  }
})

test('with two impostors, ejecting one does NOT end the match', () => {
  // The branch that regresses: the old crew-win test was "the impostor is
  // dead", which with two impostors fires as soon as either one goes.
  const ids = ['a', 'b', 'c', 'd', 'e', 'f']
  const match = createMatch(ids, seededRandom(21), { impostorCount: 2 })
  const impostors = ids.filter((id) => getRole(match, id) === 'impostor')
  assert.equal(impostors.length, 2)

  recordDeath(match, impostors[0])
  assert.equal(checkWinCondition(match, { checkTasks: false }), null)

  recordDeath(match, impostors[1])
  assert.equal(checkWinCondition(match, { checkTasks: false }), 'crew')
})

test('with two impostors, parity is reached against the pair, not against one', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f']
  const match = createMatch(ids, seededRandom(21), { impostorCount: 2 })
  const impostors = ids.filter((id) => getRole(match, id) === 'impostor')
  const crew = ids.filter((id) => !impostors.includes(id))

  recordDeath(match, crew[0]) // 3 crew vs 2 impostors
  assert.equal(checkWinCondition(match, { checkTasks: false }), null)

  recordDeath(match, crew[1]) // 2 crew vs 2 impostors -> parity
  assert.equal(checkWinCondition(match, { checkTasks: false }), 'impostor')
})

test('a player starts at full health and survives the first two hits', () => {
  const ids = ['a', 'b', 'c', 'd']
  const match = createMatch(ids, seededRandom(3))
  const victim = ids.find((id) => getRole(match, id) === 'crewmate')

  assert.equal(getHealth(match, victim), MAX_HEALTH)

  const first = damage(match, victim)
  assert.equal(first.died, false)
  assert.equal(first.health, MAX_HEALTH - 1)
  assert.equal(isAlive(match, victim), true)

  const second = damage(match, victim)
  assert.equal(second.died, false)
  assert.equal(isAlive(match, victim), true)
})

test('the third hit kills, and only then does the player leave the alive set', () => {
  const ids = ['a', 'b', 'c', 'd']
  const match = createMatch(ids, seededRandom(3))
  const victim = ids.find((id) => getRole(match, id) === 'crewmate')

  damage(match, victim)
  damage(match, victim)
  const fatal = damage(match, victim)

  assert.equal(fatal.died, true)
  assert.equal(fatal.health, 0)
  assert.equal(isAlive(match, victim), false)
})

test('hitting an already dead player changes nothing', () => {
  const ids = ['a', 'b', 'c', 'd']
  const match = createMatch(ids, seededRandom(3))
  const victim = ids.find((id) => getRole(match, id) === 'crewmate')
  damage(match, victim)
  damage(match, victim)
  damage(match, victim)

  const again = damage(match, victim)
  assert.equal(again.died, false, 'a dead player must not "die" a second time')
  assert.equal(again.health, 0)
})

test('a non-fatal hit does not change the win condition', () => {
  const ids = ['a', 'b', 'c', 'd']
  const match = createMatch(ids, seededRandom(3))
  const victim = ids.find((id) => getRole(match, id) === 'crewmate')
  damage(match, victim)
  assert.equal(checkWinCondition(match, { checkTasks: false }), null)
})

test('getImpostorIds reports every impostor', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f']
  const match = createMatch(ids, seededRandom(33), { impostorCount: 2 })
  const reported = [...getImpostorIds(match)].sort()
  const expected = ids.filter((id) => getRole(match, id) === 'impostor').sort()
  assert.deepEqual(reported, expected)
})

// --- crewmate abilities (one random spell each, one cast per match) ---

test('a crewmate may cast their spell exactly once per match', () => {
  const ids = ['a', 'b', 'c', 'd']
  const match = createMatch(ids, seededRandom(3))
  const crew = ids.find((id) => getRole(match, id) === 'crewmate')

  assert.equal(canUseSpell(match, crew), true)
  assert.equal(useSpell(match, crew), true)
  assert.equal(canUseSpell(match, crew), false)
  assert.equal(useSpell(match, crew), false, 'the second use must be refused')
})

test('one crewmate casting does not spend anyone else\'s charge', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f']
  const match = createMatch(ids, seededRandom(8))
  const crew = ids.filter((id) => getRole(match, id) === 'crewmate')
  useSpell(match, crew[0])
  for (const other of crew.slice(1)) {
    assert.equal(canUseSpell(match, other), true, `${other} lost their charge`)
  }
})

test('impostors get no spell', () => {
  const ids = ['a', 'b', 'c', 'd']
  const match = createMatch(ids, seededRandom(3))
  const impostor = ids.find((id) => getRole(match, id) === 'impostor')
  assert.equal(getSpell(match, impostor), null)
  assert.equal(canUseSpell(match, impostor), false)
  assert.equal(useSpell(match, impostor), false)
})

test('every crewmate is dealt exactly one real spell', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f']
  const match = createMatch(ids, seededRandom(17))
  const known = new Set(SPELLS.map((s) => s.id))
  for (const id of ids) {
    if (getRole(match, id) === 'impostor') continue
    const spell = getSpell(match, id)
    assert.ok(known.has(spell), `${id} got "${spell}", which is not a spell`)
  }
})

test('spells are dealt independently, not all the same', () => {
  // Over many matches every spell should show up; if the deal were shared or
  // fixed, only one id would ever appear.
  const seen = new Set()
  for (let seed = 1; seed <= 120; seed += 1) {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f']
    const match = createMatch(ids, seededRandom(seed))
    for (const id of ids) {
      if (getRole(match, id) === 'crewmate') seen.add(getSpell(match, id))
    }
  }
  assert.equal(seen.size, SPELLS.length, `only saw ${[...seen].join(', ')}`)
})

test('a dead crewmate cannot cast', () => {
  const ids = ['a', 'b', 'c', 'd']
  const match = createMatch(ids, seededRandom(3))
  const crew = ids.find((id) => getRole(match, id) === 'crewmate')
  recordDeath(match, crew)
  assert.equal(canUseSpell(match, crew), false)
  assert.equal(useSpell(match, crew), false)
})

test('a new match deals fresh spells and fresh charges', () => {
  const ids = ['a', 'b', 'c', 'd']
  const first = createMatch(ids, seededRandom(3))
  const crew = ids.find((id) => getRole(first, id) === 'crewmate')
  useSpell(first, crew)

  const second = createMatch(ids, seededRandom(3))
  assert.equal(canUseSpell(second, crew), true)
})

// --- multi-step tasks ---

test('a one-step task completes on its first advance', () => {
  const ids = ['a', 'b', 'c', 'd']
  const match = createMatch(ids, seededRandom(3))
  const crew = ids.find((id) => getRole(match, id) === 'crewmate')
  const single = getAssignedTasks(match, crew).find((id) => stepCount(id) === 1)
  if (!single) return // this crewmate happened to draw only multi-step tasks

  const result = advanceTaskStep(match, crew, single)
  assert.equal(result.completed, true)
  assert.equal(currentStep(match, crew, single), stepCount(single))
})

test('a two-step task needs both steps, in order', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f']
  const match = createMatch(ids, seededRandom(11))
  const crew = ids.filter((id) => getRole(match, id) === 'crewmate')
  // Force a known two-step task onto a crewmate so the test never depends on
  // the random deal.
  const victim = crew[0]
  match.tasksByPlayer.set(victim, [{ taskId: 'fuse-storage-electrical', done: false }])

  assert.equal(currentStep(match, victim, 'fuse-storage-electrical'), 0)

  const first = advanceTaskStep(match, victim, 'fuse-storage-electrical')
  assert.equal(first.completed, false, 'the pickup must not complete the task')
  assert.equal(first.step, 1)
  assert.equal(currentStep(match, victim, 'fuse-storage-electrical'), 1)

  const second = advanceTaskStep(match, victim, 'fuse-storage-electrical')
  assert.equal(second.completed, true)
})

test('advancing a task that is not yours does nothing', () => {
  const ids = ['a', 'b', 'c', 'd']
  const match = createMatch(ids, seededRandom(3))
  const crew = ids.find((id) => getRole(match, id) === 'crewmate')
  const notMine = TASK_LOCATIONS.map((t) => t.id).find((id) => !getAssignedTasks(match, crew).includes(id))
  if (!notMine) return

  const result = advanceTaskStep(match, crew, notMine)
  assert.equal(result.completed, false)
  assert.equal(result.step, null, 'an unassigned task must not gain progress')
})

test('a completed task cannot be advanced again', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f']
  const match = createMatch(ids, seededRandom(11))
  const victim = ids.find((id) => getRole(match, id) === 'crewmate')
  match.tasksByPlayer.set(victim, [{ taskId: 'wiring-electrical', done: false }])

  assert.equal(advanceTaskStep(match, victim, 'wiring-electrical').completed, true)
  const again = advanceTaskStep(match, victim, 'wiring-electrical')
  assert.equal(again.completed, false)
  assert.equal(again.step, null)
})

test('two crewmates progress the same task independently', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f']
  const match = createMatch(ids, seededRandom(11))
  const crew = ids.filter((id) => getRole(match, id) === 'crewmate')
  const [one, two] = crew
  for (const id of [one, two]) match.tasksByPlayer.set(id, [{ taskId: 'fuse-storage-electrical', done: false }])

  advanceTaskStep(match, one, 'fuse-storage-electrical')
  assert.equal(currentStep(match, one, 'fuse-storage-electrical'), 1)
  assert.equal(currentStep(match, two, 'fuse-storage-electrical'), 0, "one player's progress leaked to another")
})
