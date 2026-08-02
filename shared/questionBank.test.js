import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createMathQuestion,
  drawTaskQuestion,
  drawResearchQuestion,
  shuffleQuestion,
  READING_TASKS,
  RESEARCH_QUESTIONS,
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
