import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SPELLS, getSpellById, pickSpell } from './spellPool.js'

function seededRandom(seed) {
  let state = seed
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff
    return state / 0x7fffffff
  }
}

test('every spell has a unique id, a name and a description', () => {
  assert.ok(SPELLS.length >= 3)
  assert.equal(new Set(SPELLS.map((s) => s.id)).size, SPELLS.length)
  for (const spell of SPELLS) {
    assert.ok(spell.name.length > 2, `${spell.id} has no readable name`)
    assert.ok(spell.description.length > 20, `${spell.id} has no description for the player`)
  }
})

test('getSpellById resolves every declared spell and nothing else', () => {
  for (const spell of SPELLS) assert.equal(getSpellById(spell.id)?.id, spell.id)
  assert.equal(getSpellById('nao-existe'), null)
})

test('pickSpell only ever returns a real spell id', () => {
  const ids = new Set(SPELLS.map((s) => s.id))
  for (let seed = 1; seed <= 300; seed += 1) {
    assert.ok(ids.has(pickSpell(seededRandom(seed))))
  }
})

test('pickSpell reaches every spell rather than favouring one', () => {
  const seen = new Set()
  for (let seed = 1; seed <= 500; seed += 1) seen.add(pickSpell(seededRandom(seed)))
  assert.equal(seen.size, SPELLS.length, `only ${seen.size} of ${SPELLS.length} spells are reachable`)
})
