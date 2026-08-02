import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createMathQuestion,
  drawTaskQuestion,
  drawResearchQuestion,
  shuffleQuestion,
  READING_TASKS,
  RESEARCH_QUESTIONS,
  createWiringSet,
  createOrderingSet,
  createTableRound,
  createAsteroidRound,
  drawActivityForRoom,
} from './questionBank.js'

function seededRandom(seed) {
  let state = seed
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff
    return state / 0x7fffffff
  }
}

// The arithmetic is generated, so correctness has to be checked by actually
// evaluating what the prompt asks - not by trusting the generator.
function evaluatePrompt(prompt) {
  const match = prompt.match(/Quanto é (\d+) ([+−×÷]) (\d+)\?/)
  assert.ok(match, `unparseable prompt: ${prompt}`)
  const a = Number(match[1])
  const b = Number(match[3])
  switch (match[2]) {
    case '+':
      return a + b
    case '−':
      return a - b
    case '×':
      return a * b
    default:
      return a / b
  }
}

test('every generated math question has a correct, present answer', () => {
  for (let seed = 1; seed <= 500; seed += 1) {
    const q = createMathQuestion(seededRandom(seed))
    const expected = evaluatePrompt(q.prompt)
    assert.equal(q.options[q.answerIndex], String(expected), `wrong answer for "${q.prompt}"`)
  }
})

test('math questions always offer exactly 4 distinct options', () => {
  for (let seed = 1; seed <= 500; seed += 1) {
    const q = createMathQuestion(seededRandom(seed))
    assert.equal(q.options.length, 4, `"${q.prompt}" had ${q.options.length} options`)
    assert.equal(new Set(q.options).size, 4, `"${q.prompt}" had duplicate options`)
  }
})

test('math stays age-appropriate: no negatives, no remainders, results within reach', () => {
  for (let seed = 1; seed <= 500; seed += 1) {
    const q = createMathQuestion(seededRandom(seed))
    const answer = evaluatePrompt(q.prompt)
    assert.ok(Number.isInteger(answer), `"${q.prompt}" does not divide evenly`)
    assert.ok(answer >= 0, `"${q.prompt}" is negative`)
    assert.ok(answer <= 100, `"${q.prompt}" gives ${answer}, too large for the target age`)
    for (const option of q.options) assert.ok(Number(option) >= 0, `"${q.prompt}" offers a negative option`)
  }
})

test('every authored reading task is well formed', () => {
  assert.ok(READING_TASKS.length >= 3)
  for (const task of READING_TASKS) {
    assert.ok(task.passage.length > 40, 'passage too short to be a comprehension exercise')
    assert.ok(task.prompt.endsWith('?'))
    assert.equal(task.options.length, 4)
    assert.equal(new Set(task.options).size, 4)
    assert.ok(task.answerIndex >= 0 && task.answerIndex < 4)
  }
})

test('every authored research question is well formed and has a hint', () => {
  assert.ok(RESEARCH_QUESTIONS.length >= 4)
  for (const question of RESEARCH_QUESTIONS) {
    assert.ok(question.prompt.endsWith('?'))
    assert.ok(question.hint && question.hint.length > 10, 'a research question needs a hint to point the child somewhere')
    assert.equal(question.options.length, 4)
    assert.equal(new Set(question.options).size, 4)
    assert.ok(question.answerIndex >= 0 && question.answerIndex < 4)
  }
})

test('shuffleQuestion keeps answerIndex pointing at the same text', () => {
  for (const original of [...READING_TASKS, ...RESEARCH_QUESTIONS]) {
    const correctText = original.options[original.answerIndex]
    for (let seed = 1; seed <= 40; seed += 1) {
      const shuffled = shuffleQuestion(original, seededRandom(seed))
      assert.equal(shuffled.options[shuffled.answerIndex], correctText)
      assert.equal(new Set(shuffled.options).size, 4)
    }
  }
})

test('shuffleQuestion does not always leave the answer in the same slot', () => {
  const positions = new Set()
  for (let seed = 1; seed <= 60; seed += 1) {
    positions.add(shuffleQuestion(READING_TASKS[0], seededRandom(seed)).answerIndex)
  }
  assert.ok(positions.size > 1, 'shuffling never moved the correct answer')
})

test('in-match tasks draw only arithmetic or reading, never a research question', () => {
  const researchPrompts = new Set(RESEARCH_QUESTIONS.map((q) => q.prompt))
  const seenTypes = new Set()
  for (let seed = 1; seed <= 300; seed += 1) {
    const q = drawTaskQuestion(seededRandom(seed))
    assert.equal(researchPrompts.has(q.prompt), false, 'a research question leaked into an in-match task')
    seenTypes.add(q.type ?? 'leitura')
  }
  // Both kinds must actually come up, or half the content is dead code.
  assert.ok(seenTypes.size > 1, `only one kind of task question was ever drawn: ${[...seenTypes]}`)
})

test('drawResearchQuestion returns a usable, shuffled research question', () => {
  for (let seed = 1; seed <= 50; seed += 1) {
    const q = drawResearchQuestion(seededRandom(seed))
    assert.ok(q.hint)
    assert.equal(q.options.length, 4)
    assert.ok(q.options[q.answerIndex])
  }
})

// --- per-room activity generators ---

test('a wiring set pairs every prompt with a distinct, correct result', () => {
  for (let seed = 1; seed <= 200; seed += 1) {
    const set = createWiringSet(seededRandom(seed))
    assert.equal(set.prompts.length, 3)
    assert.equal(set.results.length, 3)
    assert.equal(new Set(set.results).size, 3, 'two sockets share a value, so a wrong wire would look right')
    for (const pair of set.prompts) {
      const [a, b] = pair.prompt.split(' × ').map(Number)
      assert.equal(a * b, pair.result, `${pair.prompt} does not equal ${pair.result}`)
      assert.ok(set.results.includes(pair.result), 'a prompt has no socket to connect to')
    }
  }
})

test('an ordering set is solvable and actually shuffled', () => {
  let everShuffled = false
  for (let seed = 1; seed <= 200; seed += 1) {
    const set = createOrderingSet(seededRandom(seed))
    assert.equal(set.values.length, 5)
    assert.equal(new Set(set.values).size, 5, 'duplicate values make "the next smallest" ambiguous')
    assert.deepEqual([...set.solution], [...set.values].sort((a, b) => a - b))
    if (set.values.join(',') !== set.solution.join(',')) everShuffled = true
  }
  assert.ok(everShuffled, 'the puzzle is always presented already solved')
})

test('a table round asks about a row that exists and offers its real value', () => {
  for (let seed = 1; seed <= 200; seed += 1) {
    const round = createTableRound(seededRandom(seed))
    assert.equal(round.rows.length, 4)
    assert.equal(round.options.length, 4)
    assert.equal(new Set(round.options).size, 4)
    const asked = round.rows.find((row) => round.prompt.includes(row.room))
    assert.ok(asked, `the prompt asks about a room not in the table: ${round.prompt}`)
    assert.equal(round.options[round.answerIndex], String(asked.count))
  }
})

test('an asteroid round is a correct arithmetic question', () => {
  for (let seed = 1; seed <= 200; seed += 1) {
    const round = createAsteroidRound(seededRandom(seed))
    assert.equal(round.options.length, 4)
    assert.ok(round.options[round.answerIndex])
    assert.ok(round.prompt.startsWith('Quanto é'))
  }
})

test('every room with an activity produces one, and unknown rooms still get a question', () => {
  const rooms = ['electrical', 'reactor', 'admin', 'weapons', 'navigation']
  const types = new Set()
  for (const roomId of rooms) {
    const activity = drawActivityForRoom(roomId, seededRandom(7))
    assert.ok(activity.type, `${roomId} produced an activity with no type`)
    types.add(activity.type)
  }
  assert.equal(types.size, rooms.length, `rooms share an activity type: ${[...types]}`)

  // A room with no bespoke activity must still be playable.
  const fallback = drawActivityForRoom('storage', seededRandom(7))
  assert.ok(fallback.options?.length >= 2, 'the fallback is not answerable')
})
