// Crewmate abilities. Each crewmate is dealt one at random when the match
// starts and may cast it once. Pure data plus a pure picker so the roll is
// testable and the client can describe a spell without asking the server.
//
// Impostors get none: casting therefore proves you are crew to anyone
// watching, which is a real cost, not an oversight.
export const SPELLS = [
  {
    id: 'clarao',
    name: 'Clarão',
    description: 'Cega por instantes quem estiver te vendo e te deixa mais rápido. Sua fuga.',
    // A blinded bot records nothing, so a flash next to a murder destroys
    // the evidence - the reason this is interesting and not just strong.
    blindSeconds: 2,
    hasteSeconds: 3,
  },
  {
    id: 'radar',
    name: 'Radar',
    description: 'Mostra todos os jogadores no mapa por alguns segundos. Prova para a reunião.',
    revealSeconds: 4,
  },
  {
    id: 'embaralhar',
    name: 'Embaralhar',
    description: 'Teleporta todo mundo para salas aleatórias. Desfaz qualquer emboscada.',
  },
]

const SPELLS_BY_ID = new Map(SPELLS.map((spell) => [spell.id, spell]))

export function getSpellById(spellId) {
  return SPELLS_BY_ID.get(spellId) ?? null
}

export function pickSpell(randomFn = Math.random) {
  return SPELLS[Math.floor(randomFn() * SPELLS.length)].id
}
