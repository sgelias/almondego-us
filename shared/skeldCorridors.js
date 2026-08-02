import { ROOM_LAYOUT } from './skeldRooms.js'
import { computeCorridors } from './corridorRouting.js'

export const CORRIDOR_WIDTH = 4

// upperEngine-reactor's straight/single-bend routes both tunnel through
// lowerEngine (it sits directly between them); the BFS router handles every
// other connection but this one reads better hand-authored.
export const CORRIDOR_OVERRIDES = {
  'reactor->upperEngine': [
    [-33, 11],
    [-25, 11],
    [-25, -33],
    [-33, -33],
  ],
}

// Computed once, here, so the client's rendered/collidable geometry
// (src/map/skeldMap.js) and the server's bot pathing (shared/navGraph.js)
// are provably the same corridors. If these were computed separately with
// separately-declared overrides, any drift between them would put bots on
// paths that walk through walls the human players can actually see.
// Routed one deck at a time. The router treats every room it is not
// connecting as an obstacle, so mixing decks would have a laboratory on the
// upper deck blocking a corridor on the lower one - two floors apart and
// utterly unrelated. Each corridor carries the deck it belongs to, because
// downstream (geometry, minimap, bot pathing) all need to know which floor
// they are drawing or walking.
function corridorsForDeck(deck) {
  const rooms = ROOM_LAYOUT.filter((room) => room.deck === deck)
  return computeCorridors(rooms, CORRIDOR_WIDTH, CORRIDOR_OVERRIDES).map((corridor) => ({ ...corridor, deck }))
}

export const SKELD_CORRIDORS = [...corridorsForDeck(0), ...corridorsForDeck(1)]
