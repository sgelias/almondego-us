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
export const SKELD_CORRIDORS = computeCorridors(ROOM_LAYOUT, CORRIDOR_WIDTH, CORRIDOR_OVERRIDES)
