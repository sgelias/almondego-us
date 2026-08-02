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
