// Ship emergencies. Every so often something happens to everyone at once:
// a shared beat that interrupts whatever each player was doing and gives the
// round a story.
//
// Deliberately positive-stakes. Failing one never kills anybody and never
// ends the match - the blackout is punishing enough on its own while it
// lasts, and the leak simply does not heal you. For a game aimed at children,
// a countdown that can wipe the crew turns a shared moment into dread.
export const SHIP_EVENTS = [
  {
    id: 'apagao',
    name: 'Queda de energia',
    description: 'As luzes se apagaram! O impostor enxerga no escuro. Corra até a Elétrica e religue o painel.',
    durationSeconds: 40,
    // Vision collapses to arm's length while this is running - the reason to
    // hurry, and a gift to the impostors.
    visionRadius: 3.5,
    panels: [{ id: 'apagao-eletrica', roomId: 'electrical', offset: [-1.5, 0, 2.5] }],
  },
  {
    id: 'vazamento',
    name: 'Vazamento de oxigênio',
    description: 'Dois tripulantes precisam acionar os painéis do O2 e da Comunicação juntos!',
    durationSeconds: 45,
    // Fixing it restores everyone to full health, which is a real reward now
    // that a kill takes three hits.
    healsOnFix: true,
    panels: [
      { id: 'vazamento-o2', roomId: 'o2', offset: [0, 0, -1.5] },
      { id: 'vazamento-comunicacao', roomId: 'communications', offset: [0, 0, 1.5] },
    ],
  },
]

// How long a panel stays "armed" after being pressed. Two panels in two
// rooms cannot literally be pressed on the same tick by two children, so
// "together" means within this window - which is what makes the two-person
// event actually achievable while still forcing coordination.
export const ARM_WINDOW_SECONDS = 12

// Seconds of calm before the first event, and between events afterwards.
export const FIRST_EVENT_DELAY_SECONDS = 45
export const EVENT_INTERVAL_SECONDS = 70
// When an event is deferred because a meeting is running, try again soon
// rather than pushing a whole interval away - otherwise one meeting can
// silently swallow the next couple of minutes of emergencies.
export const EVENT_RETRY_SECONDS = 12

const EVENTS_BY_ID = new Map(SHIP_EVENTS.map((event) => [event.id, event]))

export function getEventById(eventId) {
  return EVENTS_BY_ID.get(eventId) ?? null
}

export function getPanel(panelId) {
  for (const event of SHIP_EVENTS) {
    const panel = event.panels.find((p) => p.id === panelId)
    if (panel) return { event, panel }
  }
  return null
}

export function pickEvent(randomFn = Math.random) {
  return SHIP_EVENTS[Math.floor(randomFn() * SHIP_EVENTS.length)].id
}

export function panelPosition(roomLayout, panelId) {
  const found = getPanel(panelId)
  if (!found) return null
  const room = roomLayout.find((r) => r.id === found.panel.roomId)
  if (!room) return null
  return [
    room.center[0] + found.panel.offset[0],
    room.center[1] + found.panel.offset[1],
    room.center[2] + found.panel.offset[2],
  ]
}
