// The ship has two decks. Everything that used to be a flat (x, z) world now
// has to answer "which deck?", and it must answer it the same way on the
// server, in the bots, and in the client - a bot that thinks it is upstairs
// while the client draws it downstairs is a bot that kills you from nowhere.
//
// So the rule lives here, once: a y coordinate belongs to whichever deck
// floor it is nearest.

export const DECK_HEIGHT = 7
export const DECK_COUNT = 2
export const DECKS = [0, 1]

export const DECK_LABELS = ['Deck inferior', 'Deck superior']

export function deckFloorY(deck) {
  return deck * DECK_HEIGHT
}

// Rounding, not flooring: it puts the boundary at the midpoint of a stair
// run, so someone halfway up already counts as being on the deck they are
// heading to. Anything else leaves a stretch of stair where a player is on
// neither deck and therefore invisible to everyone.
export function deckAtY(y) {
  if (!Number.isFinite(y)) return 0
  const deck = Math.round(y / DECK_HEIGHT)
  return Math.max(0, Math.min(DECK_COUNT - 1, deck))
}

export function deckOfRoom(room) {
  return room.deck ?? 0
}
