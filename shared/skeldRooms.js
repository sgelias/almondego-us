import { DECK_HEIGHT } from './decks.js'

// Deck 0 - the original ship. `deck` is written out on every room rather
// than defaulted, because a room whose deck is a typo away from wrong is a
// room players can see through the floor of.
//
// `connections` never crosses decks. The only way up or down is a stairwell,
// declared in skeldStairs.js, so there is exactly one kind of vertical link
// to get right instead of two.
const LOWER_DECK = [
  { id: 'cafeteria', deck: 0, center: [-11, 0, 33], size: [14, 4, 14], theme: 'cafeteria', connections: ['weapons', 'admin', 'storage', 'medbay', 'upperEngine', 'stairAft'] },
  { id: 'weapons', deck: 0, center: [11, 0, 11], size: [8, 4, 8], theme: 'weapons', connections: ['cafeteria', 'navigation', 'o2', 'shields', 'stairFore'] },
  { id: 'navigation', deck: 0, center: [33, 0, 33], size: [8, 4, 8], theme: 'controls', connections: ['weapons', 'o2', 'shields'] },
  { id: 'o2', deck: 0, center: [33, 0, 11], size: [6, 4, 6], theme: 'greenhouse', connections: ['weapons', 'navigation', 'shields'] },
  { id: 'shields', deck: 0, center: [33, 0, -11], size: [8, 4, 8], theme: 'controls', connections: ['navigation', 'o2', 'weapons', 'communications', 'storage'] },
  { id: 'communications', deck: 0, center: [33, 0, -33], size: [8, 4, 6], theme: 'servers', connections: ['shields', 'storage'] },
  { id: 'storage', deck: 0, center: [11, 0, -33], size: [10, 4, 10], theme: 'storage', connections: ['cafeteria', 'communications', 'shields', 'electrical', 'lowerEngine'] },
  { id: 'electrical', deck: 0, center: [-11, 0, -11], size: [8, 4, 8], theme: 'electrical', connections: ['storage', 'lowerEngine', 'admin'] },
  { id: 'lowerEngine', deck: 0, center: [-33, 0, -11], size: [8, 4, 8], theme: 'engine', connections: ['electrical', 'storage', 'security', 'reactor'] },
  { id: 'upperEngine', deck: 0, center: [-33, 0, 11], size: [8, 4, 8], theme: 'engine', connections: ['cafeteria', 'security', 'reactor', 'stairAft'] },
  { id: 'security', deck: 0, center: [-11, 0, -33], size: [6, 4, 6], theme: 'security', connections: ['upperEngine', 'lowerEngine', 'reactor'] },
  { id: 'reactor', deck: 0, center: [-33, 0, -33], size: [8, 4, 10], theme: 'reactor', connections: ['upperEngine', 'lowerEngine', 'security'] },
  { id: 'medbay', deck: 0, center: [-11, 0, 11], size: [8, 4, 8], theme: 'medbay', connections: ['cafeteria', 'admin'] },
  { id: 'admin', deck: 0, center: [11, 0, -11], size: [8, 4, 8], theme: 'admin', connections: ['cafeteria', 'medbay', 'electrical', 'stairFore'] },

  // The stairwells. They are ordinary rooms on this deck - floor, walls,
  // doorways, corridors routed like any other - which is the point: no new
  // geometry to get wrong, only a ramp inside. Their footprints were found
  // by scanning the deck for space clear of every existing room and
  // corridor, not chosen by eye.
  { id: 'stairFore', deck: 0, center: [20, 0, 1], size: [6, 4, 14], theme: 'stairs', connections: ['weapons', 'admin'] },
  { id: 'stairAft', deck: 0, center: [-24, 0, 22], size: [6, 4, 14], theme: 'stairs', connections: ['upperEngine', 'cafeteria'] },
]

// Deck 1 - the science deck, reached only by the two stairwells.
const UPPER_DECK = [
  // The stair landings. They sit immediately BEYOND the top of the ramp,
  // never above it: a landing overhanging the ramp would put its own floor
  // slab in the face of anyone climbing the last two metres.
  // No direct link to hydroponics: the router's route out of here turned
  // north while still inside this room's own footprint, crossing a wall with
  // no doorway in it. Hydroponics is reached through the observatory.
  { id: 'stairForeTop', deck: 1, center: [20, DECK_HEIGHT, -10], size: [6, 4, 8], theme: 'stairs', connections: ['laboratory', 'archive'] },
  { id: 'stairAftTop', deck: 1, center: [-24, DECK_HEIGHT, 33], size: [6, 4, 8], theme: 'stairs', connections: ['observatory'] },

  { id: 'laboratory', deck: 1, center: [0, DECK_HEIGHT, 0], size: [10, 4, 10], theme: 'laboratory', connections: ['stairForeTop', 'observatory', 'archive', 'radioTower'], windows: ['east'] },
  // The observatory faces the bow with a full glazed wall. It is the room
  // the whole upper deck is named for; you should be able to stand in it and
  // just look out.
  { id: 'observatory', deck: 1, center: [0, DECK_HEIGHT, 22], size: [12, 4, 10], theme: 'observatory', connections: ['stairAftTop', 'laboratory', 'hydroponics', 'radioTower'], windows: ['north'] },
  { id: 'hydroponics', deck: 1, center: [22, DECK_HEIGHT, 22], size: [8, 4, 8], theme: 'greenhouse', connections: ['observatory'], windows: ['east', 'north'] },
  { id: 'archive', deck: 1, center: [0, DECK_HEIGHT, -22], size: [8, 4, 8], theme: 'archive', connections: ['laboratory', 'stairForeTop'], windows: ['south'] },
  { id: 'radioTower', deck: 1, center: [-24, DECK_HEIGHT, 8], size: [8, 4, 8], theme: 'servers', connections: ['laboratory', 'observatory'], windows: ['west'] },
]

export const ROOM_LAYOUT = [...LOWER_DECK, ...UPPER_DECK]
