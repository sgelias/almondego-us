import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createBotBrain } from './botBrain.js'

const LIVING = ['bot', 'a', 'b', 'c', 'd', 'e']

function seededRandom(seed) {
  let state = seed
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff
    return state / 0x7fffffff
  }
}

// Below BLIND_SKIP_CHANCE, so the no-evidence branch always resolves to
// 'skip'. Tests asserting "this signal must NOT implicate anyone" use this:
// a vote of 'skip' proves the evidence branch didn't fire, whereas letting
// the random branch pick a name could coincidentally match the name under
// test and pass/fail for the wrong reason.
const alwaysSkip = () => 0.1

test('a witnessed killer outranks every other signal', () => {
  const brain = createBotBrain('bot')
  brain.noteWitnessedVent('b', 'electrical', 100)
  brain.noteNearbyPlayers(['bot', 'c', 'd'], 'medbay', 100)
  brain.noteDeath('d')
  brain.noteWitnessedKill('a', 'd', 'medbay', 200)

  assert.equal(brain.decideVote(LIVING, seededRandom(1), 300), 'a')
})

test('a witnessed venter is chosen when no kill was seen', () => {
  const brain = createBotBrain('bot')
  brain.noteWitnessedVent('b', 'electrical', 100)
  assert.equal(brain.decideVote(LIVING, seededRandom(1), 200), 'b')
})

test('the last player seen alone with a victim is chosen when nothing was witnessed directly', () => {
  const brain = createBotBrain('bot')
  brain.noteNearbyPlayers(['bot', 'c', 'e'], 'storage', 1000)
  brain.noteDeath('c')
  assert.equal(brain.decideVote(LIVING, seededRandom(1), 1200), 'e')
})

test('a co-location with more than one companion does not implicate anyone', () => {
  const brain = createBotBrain('bot')
  brain.noteNearbyPlayers(['bot', 'c', 'd', 'e'], 'storage', 1000)
  brain.noteDeath('c')
  // 'd' and 'e' were both with the victim, so neither is singled out - it
  // must fall through to the blind branch.
  assert.equal(brain.decideVote(LIVING, alwaysSkip, 1200), 'skip')
})

test('stale co-location memory is not used to implicate anyone', () => {
  const brain = createBotBrain('bot')
  brain.noteNearbyPlayers(['bot', 'c', 'e'], 'storage', 0)
  brain.noteDeath('c')
  // Well past the co-location memory window, so it must fall through.
  assert.equal(brain.decideVote(LIVING, alwaysSkip, 999999), 'skip')
})

test('a dead suspect is skipped in favour of a still-living one', () => {
  const brain = createBotBrain('bot')
  brain.noteWitnessedKill('a', 'd', 'medbay', 100)
  brain.noteWitnessedVent('b', 'electrical', 150)
  // 'a' was ejected last meeting and is no longer in the living roster.
  assert.equal(brain.decideVote(['bot', 'b', 'c'], seededRandom(1), 300), 'b')
})

test('a bot never votes for itself', () => {
  const brain = createBotBrain('bot')
  for (let seed = 1; seed <= 200; seed += 1) {
    assert.notEqual(brain.decideVote(LIVING, seededRandom(seed), 100), 'bot')
  }
})

test('a bot with an empty sighting log does NOT reliably find the impostor', () => {
  // The whole point of the witness-limited memory rule: with no evidence, a
  // bot must be no better than chance. If this ever starts passing at a high
  // rate, something has handed the brain the answer key.
  const IMPOSTOR = 'a'
  const TRIALS = 2000
  let hits = 0
  for (let seed = 1; seed <= TRIALS; seed += 1) {
    const brain = createBotBrain('bot')
    if (brain.decideVote(LIVING, seededRandom(seed), 100) === IMPOSTOR) hits += 1
  }
  const hitRate = hits / TRIALS
  // 5 possible accusations, half the time it skips -> ~10% expected.
  assert.ok(hitRate < 0.25, `blind bots picked the impostor ${(hitRate * 100).toFixed(1)}% of the time`)
})

test('a bot with no living candidates skips', () => {
  const brain = createBotBrain('bot')
  assert.equal(brain.decideVote(['bot'], seededRandom(1), 100), 'skip')
})

test('a witnessed kill is reported after a short reaction delay, not instantly', () => {
  const brain = createBotBrain('bot')
  brain.noteWitnessedKill('a', 'd', 'medbay', 1000)
  assert.equal(brain.shouldCallMeeting(1100), false)
  assert.equal(brain.shouldCallMeeting(5000), true)
})

test('a bot with nothing to report never calls a meeting', () => {
  const brain = createBotBrain('bot')
  assert.equal(brain.shouldCallMeeting(999999), false)
})

test('an unwitnessed death is still reported eventually, but much later than a witnessed one', () => {
  // playerDied is broadcast to everyone, so "someone is gone" is public
  // knowledge - it just takes a bot longer to act on than a murder it saw.
  const witnessed = createBotBrain('witness', () => 0)
  witnessed.noteDeath('d', 1000)
  witnessed.noteWitnessedKill('a', 'd', 'medbay', 1000)

  const unaware = createBotBrain('unaware', () => 0)
  unaware.noteDeath('d', 1000)

  assert.equal(witnessed.shouldCallMeeting(4000), true)
  assert.equal(unaware.shouldCallMeeting(4000), false)
  assert.equal(unaware.shouldCallMeeting(1000 + 12000), true)
})

test('a death already discussed at a meeting is never re-reported', () => {
  const brain = createBotBrain('bot', () => 0)
  brain.noteDeath('d', 0)
  assert.equal(brain.shouldCallMeeting(99999), true)
  brain.clearAfterMeeting()
  assert.equal(brain.shouldCallMeeting(99999), false)
})

test('a bot does not witness (or report) its own kill', () => {
  const brain = createBotBrain('bot')
  brain.noteWitnessedKill('bot', 'd', 'medbay', 100)
  assert.equal(brain.witnessedKillCount, 0)
  // The impostor bot still learns of the death publicly like everyone else,
  // but it has no witnessed-kill evidence to act on.
  assert.equal(brain.shouldCallMeeting(150), false)
})

test('a bot does not treat its own venting as evidence against itself', () => {
  const brain = createBotBrain('bot')
  brain.noteWitnessedVent('bot', 'electrical', 100)
  assert.notEqual(brain.decideVote(LIVING, () => 0.9, 200), 'bot')
})

test('hard evidence survives a meeting but co-location memory does not', () => {
  const brain = createBotBrain('bot')
  brain.noteWitnessedKill('a', 'd', 'medbay', 100)
  brain.noteNearbyPlayers(['bot', 'c', 'e'], 'storage', 100)
  brain.noteDeath('c')

  brain.clearAfterMeeting()

  // Still remembers the murder it saw...
  assert.equal(brain.decideVote(LIVING, seededRandom(1), 300), 'a')
  // ...but the co-location trail is gone, so with 'a' now ejected it falls
  // through to the blind branch rather than implicating 'e'.
  assert.equal(brain.decideVote(['bot', 'c', 'e'], alwaysSkip, 300), 'skip')
})
