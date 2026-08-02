// Task locations.
//
// Every task is a list of *steps*, even the one-step ones - a single uniform
// shape means nothing downstream has to branch between "simple" and "fetch"
// tasks. A step is a place you have to physically be.
//
// The educational question (AD-008) is asked at the LAST step only. Earlier
// steps are a single key press: the point of a two-step task is the journey,
// not two quizzes. That journey is what feeds the social deduction - being
// seen crossing the ship, and how long you took, is evidence.
//
// `label` is what the player reads in the HUD, so room names match
// src/ui/minimap.js exactly - a task naming a room that appears nowhere on
// the map sends a child hunting for it.
export const TASK_LOCATIONS = [
  {
    id: 'wiring-electrical',
    label: 'Consertar a fiação (Elétrica)',
    steps: [{ roomId: 'electrical', offset: [1.5, 0, 1.5], verb: 'consertar a fiação' }],
  },
  {
    id: 'calibrate-navigation',
    label: 'Calibrar a rota (Navegação)',
    steps: [{ roomId: 'navigation', offset: [-1.5, 0, 0], verb: 'calibrar a rota' }],
  },
  {
    id: 'swipe-card-admin',
    label: 'Passar o cartão (Admin)',
    steps: [{ roomId: 'admin', offset: [0, 0, 2], verb: 'passar o cartão' }],
  },
  {
    id: 'clear-asteroids-weapons',
    label: 'Destruir asteroides (Armas)',
    steps: [{ roomId: 'weapons', offset: [-1.5, 0, -1.5], verb: 'destruir asteroides' }],
  },
  // Two-step tasks: fetch in one room, use it in another.
  {
    id: 'fuse-storage-electrical',
    label: 'Trocar o fusível (Depósito → Elétrica)',
    steps: [
      { roomId: 'storage', offset: [2, 0, -2], verb: 'pegar o fusível', carrying: 'Fusível' },
      { roomId: 'electrical', offset: [-1.5, 0, -1.5], verb: 'instalar o fusível' },
    ],
  },
  {
    id: 'sample-medbay-reactor',
    label: 'Levar a amostra (Enfermaria → Reator)',
    steps: [
      { roomId: 'medbay', offset: [2, 0, 0], verb: 'coletar a amostra', carrying: 'Amostra' },
      { roomId: 'reactor', offset: [0, 0, 3], verb: 'analisar a amostra' },
    ],
  },

  // --- science deck (upper) ---
  //
  // Reaching any of these means finding a staircase and climbing it, which
  // is a real commitment: about five seconds each way, in a stairwell with
  // one way out. That is the point of putting objectives up here rather than
  // just rooms.
  {
    id: 'clock-observatory',
    label: 'Acertar o relógio da nave (Observatório)',
    steps: [{ roomId: 'observatory', offset: [2, 0, -2], verb: 'ler o relógio' }],
  },
  {
    id: 'balance-laboratory',
    label: 'Equilibrar a balança (Laboratório)',
    steps: [{ roomId: 'laboratory', offset: [-2, 0, 2], verb: 'equilibrar a balança' }],
  },
  {
    id: 'water-hydroponics',
    label: 'Regar os canteiros (Estufa)',
    steps: [{ roomId: 'hydroponics', offset: [1.5, 0, 1.5], verb: 'regar os canteiros' }],
  },
  {
    id: 'file-archive',
    label: 'Arquivar as fichas (Arquivo)',
    steps: [{ roomId: 'archive', offset: [0, 0, 2], verb: 'arquivar as fichas' }],
  },
  {
    id: 'signal-radioTower',
    label: 'Decifrar o sinal (Torre de Rádio)',
    steps: [{ roomId: 'radioTower', offset: [-1.5, 0, 0], verb: 'decifrar o sinal' }],
  },

  // Two tasks that cross between decks. The existing fetch tasks make you
  // walk the ship; these make you climb it, which is a much bigger
  // commitment - you are out of sight of the lower deck for the whole trip,
  // and everyone who saw you head for the stairs knows it.
  {
    id: 'sample-medbay-laboratory',
    label: 'Levar a amostra (Enfermaria → Laboratório)',
    steps: [
      { roomId: 'medbay', offset: [2, 0, -2], verb: 'coletar a amostra', carrying: 'Amostra' },
      { roomId: 'laboratory', offset: [2, 0, -2], verb: 'analisar a amostra' },
    ],
  },
  {
    id: 'antenna-storage-radioTower',
    label: 'Trocar a antena (Depósito → Torre de Rádio)',
    steps: [
      { roomId: 'storage', offset: [-2, 0, 2], verb: 'pegar a antena', carrying: 'Antena' },
      { roomId: 'radioTower', offset: [1.5, 0, 1.5], verb: 'instalar a antena' },
    ],
  },
]

export function getTaskById(taskId) {
  return TASK_LOCATIONS.find((task) => task.id === taskId) ?? null
}

export function stepCount(taskId) {
  return getTaskById(taskId)?.steps.length ?? 0
}

// Where a given step physically is: the room's centre plus its offset.
// Everything that needs a task's position - the console meshes on the map,
// the guide arrows, the bots' pathing - goes through this one function, so
// they cannot drift apart and send someone to the wrong spot.
export function stepPosition(roomLayout, taskId, stepIndex) {
  const step = getTaskById(taskId)?.steps[stepIndex]
  if (!step) return null
  const room = roomLayout.find((r) => r.id === step.roomId)
  if (!room) return null
  // room.center[1], not 0: a console in an upper-deck room belongs on that
  // deck's floor, not on the ground floor seven metres below it.
  return [room.center[0] + step.offset[0], room.center[1] + step.offset[1], room.center[2] + step.offset[2]]
}
