// Educational content for the task minigames (see STATE.md AD-008).
// Aimed at children up to about 10, in Portuguese, at a single fixed
// difficulty level. Pure data and pure functions so it unit-tests without a
// browser and can be extended without touching any game code.

const MATH_KINDS = ['soma', 'subtracao', 'multiplicacao', 'divisao']

function randomInt(randomFn, min, max) {
  return min + Math.floor(randomFn() * (max - min + 1))
}

// Distractors sit near the right answer so the child has to actually work
// the problem out rather than spot the one plausible number.
function buildOptions(answer, randomFn) {
  const options = new Set([answer])
  let guard = 0
  while (options.size < 4 && guard < 50) {
    guard += 1
    const spread = randomInt(randomFn, 1, 5)
    const candidate = randomFn() < 0.5 ? answer - spread : answer + spread
    if (candidate >= 0 && candidate !== answer) options.add(candidate)
  }
  // Very small answers can run out of non-negative neighbours; pad upward.
  let pad = answer + 6
  while (options.size < 4) {
    options.add(pad)
    pad += 1
  }
  return [...options].sort(() => (randomFn() < 0.5 ? -1 : 1))
}

// Ranges chosen for the target age: sums and differences stay inside 100,
// multiplication stays within the usual times tables, and division is always
// exact so there are no remainders to explain.
export function createMathQuestion(randomFn = Math.random) {
  const kind = MATH_KINDS[randomInt(randomFn, 0, MATH_KINDS.length - 1)]
  let prompt
  let answer

  if (kind === 'soma') {
    const a = randomInt(randomFn, 5, 49)
    const b = randomInt(randomFn, 5, 49)
    prompt = `Quanto é ${a} + ${b}?`
    answer = a + b
  } else if (kind === 'subtracao') {
    const a = randomInt(randomFn, 20, 99)
    const b = randomInt(randomFn, 1, a - 1)
    prompt = `Quanto é ${a} − ${b}?`
    answer = a - b
  } else if (kind === 'multiplicacao') {
    const a = randomInt(randomFn, 2, 10)
    const b = randomInt(randomFn, 2, 10)
    prompt = `Quanto é ${a} × ${b}?`
    answer = a * b
  } else {
    const b = randomInt(randomFn, 2, 10)
    answer = randomInt(randomFn, 2, 10)
    prompt = `Quanto é ${b * answer} ÷ ${b}?`
  }

  const options = buildOptions(answer, randomFn).map(String)
  return {
    type: 'matematica',
    title: 'Cálculo',
    prompt,
    options,
    answerIndex: options.indexOf(String(answer)),
  }
}

// Short passages with one comprehension question each. Kept to a few
// sentences so reading them doesn't stall a match.
export const READING_TASKS = [
  {
    title: 'Leitura',
    passage:
      'As baleias-jubarte viajam mais de 8 mil quilômetros todos os anos. Elas passam o verão nos mares gelados, onde encontram bastante comida, e nadam até águas quentes para ter seus filhotes. Os filhotes nascem sem gordura suficiente para aguentar o frio.',
    prompt: 'Por que as baleias-jubarte nadam para águas quentes?',
    options: [
      'Para ter seus filhotes, que não aguentam o frio',
      'Porque encontram mais comida lá',
      'Para fugir dos navios',
      'Porque não sabem nadar em água gelada',
    ],
    answerIndex: 0,
  },
  {
    title: 'Leitura',
    passage:
      'A Lua não tem luz própria. O que enxergamos no céu é a luz do Sol refletida na superfície dela. Por isso a Lua parece mudar de forma durante o mês: dependendo de onde ela está, vemos uma parte maior ou menor do lado iluminado.',
    prompt: 'Por que a Lua parece mudar de forma durante o mês?',
    options: [
      'Porque vemos partes diferentes do lado iluminado pelo Sol',
      'Porque ela acende e apaga sozinha',
      'Porque as nuvens cobrem pedaços dela',
      'Porque ela diminui de tamanho',
    ],
    answerIndex: 0,
  },
  {
    title: 'Leitura',
    passage:
      'As formigas cortadeiras não comem as folhas que carregam. Elas levam os pedaços para dentro do formigueiro e usam as folhas para cultivar um fungo. É esse fungo que serve de alimento para a colônia inteira.',
    prompt: 'Para que as formigas cortadeiras usam as folhas?',
    options: [
      'Para cultivar um fungo que a colônia come',
      'Para comer as folhas no caminho',
      'Para fechar a entrada do formigueiro',
      'Para fazer uma cama macia',
    ],
    answerIndex: 0,
  },
  {
    title: 'Leitura',
    passage:
      'O corpo humano tem mais de 600 músculos. O menor deles fica dentro do ouvido e ajuda a proteger a audição de sons muito altos. Já o maior fica na coxa e é usado sempre que a gente levanta de uma cadeira.',
    prompt: 'O que faz o menor músculo do corpo?',
    options: [
      'Ajuda a proteger a audição de sons altos',
      'Ajuda a levantar da cadeira',
      'Faz o coração bater',
      'Movimenta os dedos da mão',
    ],
    answerIndex: 0,
  },
]

// Asked in the lobby, before the match starts (AD-008): a child needs time
// to look these up, and standing still at a console to research is exactly
// when the Impostor kills you.
export const RESEARCH_QUESTIONS = [
  {
    title: 'Missão de pesquisa',
    prompt: 'Qual é o planeta do Sistema Solar que tem o maior número de luas conhecidas?',
    hint: 'Procure por "planeta com mais luas" — o número muda conforme novas luas são descobertas!',
    options: ['Saturno', 'Marte', 'Vênus', 'Mercúrio'],
    answerIndex: 0,
  },
  {
    title: 'Missão de pesquisa',
    prompt: 'Qual é o maior animal que já existiu na Terra?',
    hint: 'Dica: ele ainda vive hoje, e não é um dinossauro.',
    options: ['Baleia-azul', 'Tiranossauro rex', 'Elefante-africano', 'Argentinossauro'],
    answerIndex: 0,
  },
  {
    title: 'Missão de pesquisa',
    prompt: 'Quantos ossos tem o corpo de uma pessoa adulta?',
    hint: 'Um bebê nasce com mais ossos do que um adulto — alguns se juntam com o tempo.',
    options: ['206', '150', '320', '98'],
    answerIndex: 0,
  },
  {
    title: 'Missão de pesquisa',
    prompt: 'Qual é o rio mais extenso do Brasil?',
    hint: 'Procure num mapa do Brasil qual rio atravessa a região Norte.',
    options: ['Rio Amazonas', 'Rio São Francisco', 'Rio Paraná', 'Rio Tietê'],
    answerIndex: 0,
  },
  {
    title: 'Missão de pesquisa',
    prompt: 'O que as plantas produzem durante a fotossíntese, além de alimento?',
    hint: 'É o gás que a gente respira.',
    options: ['Oxigênio', 'Gás carbônico', 'Nitrogênio', 'Vapor de água'],
    answerIndex: 0,
  },
]

// The options in the authored lists above are written answer-first for
// readability; shuffling here keeps the correct answer from always being the
// first button.
export function shuffleQuestion(question, randomFn = Math.random) {
  const indexed = question.options.map((option, index) => ({ option, index }))
  for (let i = indexed.length - 1; i > 0; i -= 1) {
    const j = Math.floor(randomFn() * (i + 1))
    ;[indexed[i], indexed[j]] = [indexed[j], indexed[i]]
  }
  return {
    ...question,
    options: indexed.map((entry) => entry.option),
    answerIndex: indexed.findIndex((entry) => entry.index === question.answerIndex),
  }
}

// An in-match task is either arithmetic or reading comprehension. Research
// questions are deliberately excluded - they live in the lobby.
export function drawTaskQuestion(randomFn = Math.random) {
  if (randomFn() < 0.5) return createMathQuestion(randomFn)
  const picked = READING_TASKS[Math.floor(randomFn() * READING_TASKS.length)]
  return shuffleQuestion(picked, randomFn)
}

export function drawResearchQuestion(randomFn = Math.random) {
  const picked = RESEARCH_QUESTIONS[Math.floor(randomFn() * RESEARCH_QUESTIONS.length)]
  return shuffleQuestion(picked, randomFn)
}

// --- content for the per-room minigames ---
//
// Each room's activity needs a different *shape* of exercise, not a
// different skin on the same multiple choice. These generators produce that
// shape; the rendering lives in src/game/minigames.js.

function shuffled(items, randomFn) {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(randomFn() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

// Elétrica: match each expression to its result by joining two wires.
// Results are shuffled independently of the prompts, so position never
// gives the answer away.
export function createWiringSet(randomFn = Math.random, pairCount = 3) {
  const pairs = []
  const usedResults = new Set()
  let guard = 0
  while (pairs.length < pairCount && guard < 100) {
    guard += 1
    const a = 2 + Math.floor(randomFn() * 9)
    const b = 2 + Math.floor(randomFn() * 9)
    const result = a * b
    // Distinct results, or two wires would both be "correct" for one socket.
    if (usedResults.has(result)) continue
    usedResults.add(result)
    pairs.push({ prompt: `${a} × ${b}`, result })
  }
  return {
    type: 'fios',
    title: 'Fiação',
    instruction: 'Ligue cada conta ao seu resultado.',
    prompts: shuffled(pairs, randomFn),
    results: shuffled(pairs.map((pair) => pair.result), randomFn),
  }
}

// Reator: put the values in ascending order. Ordering is a different skill
// from computing, and it reads naturally as "stabilise the core".
export function createOrderingSet(randomFn = Math.random, count = 5) {
  const values = new Set()
  let guard = 0
  while (values.size < count && guard < 200) {
    guard += 1
    values.add(1 + Math.floor(randomFn() * 99))
  }
  const sorted = [...values].sort((a, b) => a - b)
  return {
    type: 'ordem',
    title: 'Núcleo do reator',
    instruction: 'Toque nos números do menor para o maior.',
    values: shuffled(sorted, randomFn),
    solution: sorted,
  }
}

// Admin: read a small table and answer about it. The exercise is locating a
// value in rows and columns, which is a real and separate skill.
export function createTableRound(randomFn = Math.random) {
  const rooms = ['Refeitório', 'Elétrica', 'Depósito', 'Navegação']
  const counts = rooms.map(() => 1 + Math.floor(randomFn() * 9))
  const targetIndex = Math.floor(randomFn() * rooms.length)
  const answer = counts[targetIndex]

  const options = new Set([answer])
  let guard = 0
  while (options.size < 4 && guard < 60) {
    guard += 1
    const candidate = 1 + Math.floor(randomFn() * 12)
    if (candidate !== answer) options.add(candidate)
  }

  const shuffledOptions = shuffled([...options].map(String), randomFn)
  return {
    type: 'tabela',
    title: 'Registro da tripulação',
    instruction: 'Consulte a tabela e responda.',
    rows: rooms.map((room, index) => ({ room, count: counts[index] })),
    prompt: `Quantas pessoas foram registradas em ${rooms[targetIndex]}?`,
    options: shuffledOptions,
    answerIndex: shuffledOptions.indexOf(String(answer)),
  }
}

// Armas: an arithmetic question whose options are the asteroids to shoot.
// Reuses the maths generator so the difficulty stays calibrated in one place.
export function createAsteroidRound(randomFn = Math.random) {
  const question = createMathQuestion(randomFn)
  return {
    type: 'asteroides',
    title: 'Asteroides',
    instruction: 'Atire no asteroide com o resultado certo.',
    prompt: question.prompt,
    options: question.options,
    answerIndex: question.answerIndex,
  }
}

// Navegação: the reading comprehension, framed as choosing a route.
export function createRouteRound(randomFn = Math.random) {
  const picked = shuffleQuestion(READING_TASKS[Math.floor(randomFn() * READING_TASKS.length)], randomFn)
  return { ...picked, type: 'rota', title: 'Rota de navegação', instruction: 'Leia o relatório e escolha.' }
}


// --- upper deck (science deck) activities -----------------------------------
//
// Deliberately none of these is arithmetic dressed differently. The lower
// deck already covers sums, ordering and reading comprehension; a whole new
// floor that asked the same questions in new furniture would not be worth
// the climb. Each of these trains something the deck below does not.

// Observatório: reading a clock face. Whole and half hours only - "twenty
// past" is a different, later skill and this is the first one.
export function createClockRound(randomFn = Math.random) {
  const hour = 1 + Math.floor(randomFn() * 12)
  const half = randomFn() < 0.4
  const minute = half ? 30 : 0
  const label = (h, m) => `${h}:${String(m).padStart(2, '0')}`

  const correct = label(hour, minute)
  const options = new Set([correct])
  while (options.size < 4) {
    const otherHour = 1 + Math.floor(randomFn() * 12)
    const otherMinute = randomFn() < 0.5 ? 0 : 30
    options.add(label(otherHour, otherMinute))
  }
  const list = shuffled([...options], randomFn)
  return {
    type: 'relogio',
    title: 'Observatório',
    instruction: 'O relógio da nave parou de mostrar os números. Que horas ele marca?',
    hour,
    minute,
    prompt: 'Que horas são?',
    options: list,
    answerIndex: list.indexOf(correct),
  }
}

// Laboratório: balance the scales. The first taste of algebra - "what has to
// go on this side so both weigh the same" is x + a = b without the letters.
export function createBalanceRound(randomFn = Math.random) {
  const left = 2 + Math.floor(randomFn() * 9)
  const missing = 1 + Math.floor(randomFn() * 9)
  const right = left + missing

  const options = new Set([String(missing)])
  while (options.size < 4) {
    const decoy = 1 + Math.floor(randomFn() * 12)
    options.add(String(decoy))
  }
  const list = shuffled([...options], randomFn)
  return {
    type: 'balanca',
    title: 'Laboratório',
    instruction: 'A balança precisa ficar equilibrada.',
    left,
    right,
    prompt: `Quantos kg faltam do lado esquerdo para equilibrar com ${right} kg?`,
    options: list,
    answerIndex: list.indexOf(String(missing)),
  }
}

// Estufa: fractions, shown as a watered row of planters rather than as a
// notation the child has probably not met yet.
export function createFractionRound(randomFn = Math.random) {
  const total = [2, 3, 4, 5, 6, 8][Math.floor(randomFn() * 6)]
  const watered = 1 + Math.floor(randomFn() * (total - 1))
  const correct = `${watered}/${total}`

  const options = new Set([correct])
  while (options.size < 4) {
    const d = [2, 3, 4, 5, 6, 8][Math.floor(randomFn() * 6)]
    const n = 1 + Math.floor(randomFn() * d)
    options.add(`${n}/${d}`)
  }
  const list = shuffled([...options], randomFn)
  return {
    type: 'fracoes',
    title: 'Estufa',
    instruction: 'Regue os canteiros e diga que parte da estufa já foi regada.',
    total,
    filled: watered,
    prompt: 'Que fração dos canteiros está regada?',
    options: list,
    answerIndex: list.indexOf(correct),
  }
}

// Arquivo: alphabetical order. Pure literacy, and it reuses the reactor's
// tap-in-order interaction, which already handles strings.
const ARCHIVE_WORDS = [
  ['astro', 'buraco', 'cometa', 'disco', 'estrela'],
  ['bota', 'capacete', 'luva', 'mochila', 'traje'],
  ['água', 'bomba', 'cabo', 'motor', 'painel'],
  ['galáxia', 'lua', 'nuvem', 'planeta', 'sol'],
  ['alga', 'broto', 'caule', 'folha', 'raiz'],
]

export function createAlphabetRound(randomFn = Math.random) {
  const source = ARCHIVE_WORDS[Math.floor(randomFn() * ARCHIVE_WORDS.length)]
  const picked = shuffled(source, randomFn).slice(0, 4)
  // localeCompare so accented words sort the way a Portuguese-speaking child
  // is taught, not by code point.
  const solution = [...picked].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  return {
    type: 'ordem',
    title: 'Arquivo',
    instruction: 'Arquive as fichas em ordem alfabética, da primeira para a última.',
    values: picked,
    solution,
  }
}

// Torre de Rádio: complete the pattern. Sequences are reasoning rather than
// calculation - the child has to notice the rule before applying it.
export function createSequenceRound(randomFn = Math.random) {
  const start = 1 + Math.floor(randomFn() * 6)
  const stepSize = [2, 3, 4, 5, 10][Math.floor(randomFn() * 5)]
  const descending = randomFn() < 0.3
  const first = descending ? start + stepSize * 5 : start

  const shown = []
  for (let i = 0; i < 4; i += 1) shown.push(first + (descending ? -1 : 1) * stepSize * i)
  const answer = first + (descending ? -1 : 1) * stepSize * 4

  const options = new Set([String(answer)])
  while (options.size < 4) {
    const decoy = answer + (Math.floor(randomFn() * 7) - 3)
    if (decoy >= 0) options.add(String(decoy))
  }
  const list = shuffled([...options], randomFn)
  return {
    type: 'sequencia',
    title: 'Torre de Rádio',
    instruction: 'O sinal chega em um padrão. Descubra qual número vem depois.',
    sequence: shown,
    prompt: `${shown.join(', ')}, ...?`,
    options: list,
    answerIndex: list.indexOf(String(answer)),
  }
}

// Which activity a room runs. Rooms without an entry fall back to the plain
// question modal, so adding a room never breaks tasks.
const ACTIVITY_BY_ROOM = {
  electrical: createWiringSet,
  reactor: createOrderingSet,
  admin: createTableRound,
  weapons: createAsteroidRound,
  navigation: createRouteRound,

  // Upper deck.
  observatory: createClockRound,
  laboratory: createBalanceRound,
  hydroponics: createFractionRound,
  archive: createAlphabetRound,
  radioTower: createSequenceRound,
}

export function drawActivityForRoom(roomId, randomFn = Math.random) {
  const build = ACTIVITY_BY_ROOM[roomId]
  return build ? build(randomFn) : drawTaskQuestion(randomFn)
}
