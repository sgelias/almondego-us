import { DECK_HEIGHT } from './decks.js'

// The ramps that join the two decks.
//
// Each one is a plain inclined plane inside a stairwell shaft. The visible
// steps are decor; the thing the player actually stands on is the ramp. That
// split is not cosmetic - discrete steps make a capsule collider stutter and
// catch, while a plane is exactly the case three.js's capsule/octree
// resolution handles well. It also reuses the collision/decor separation the
// map already has (AD-007).
//
// 30 degrees was measured, not guessed: a probe drove the real controller up
// ramps from 15 to 90 degrees against a real octree. Everything up to 80
// climbs and 85 never does, so walls stay walls; 30 sits far below that
// margin and takes about 4.6 seconds to climb, which is long enough that
// being caught on the stairs actually means something.
export const STAIR_RUN = 12
export const STAIR_WIDTH = 4
export const STAIR_RISE = DECK_HEIGHT

export const SKELD_STAIRS = [
  {
    id: 'stair-fore',
    lower: 'stairFore',
    upper: 'stairForeTop',
    // Ramp axis. It climbs from `footZ` to `topZ`, so the top is the end
    // that touches the upper landing.
    axis: 'z',
    x: 20,
    foot: 6,
    top: -6,
  },
  {
    id: 'stair-aft',
    lower: 'stairAft',
    upper: 'stairAftTop',
    axis: 'z',
    x: -24,
    foot: 17,
    top: 29,
  },
]

// Where a stair puts you in the world, as a fraction along the climb.
// t = 0 is the foot (lower deck), t = 1 the top (upper deck). Bots walk the
// stairs with this, and the map builds the ramp from it, so a bot can never
// float above or sink below the surface a player is standing on.
export function stairPointAt(stair, t) {
  const clamped = Math.max(0, Math.min(1, t))
  const along = stair.foot + (stair.top - stair.foot) * clamped
  const y = STAIR_RISE * clamped
  return stair.axis === 'z' ? [stair.x, y, along] : [along, y, stair.x]
}

const STAIRS_BY_ROOM_PAIR = new Map()
for (const stair of SKELD_STAIRS) {
  STAIRS_BY_ROOM_PAIR.set(`${stair.lower}->${stair.upper}`, { stair, up: true })
  STAIRS_BY_ROOM_PAIR.set(`${stair.upper}->${stair.lower}`, { stair, up: false })
}

export function stairBetween(fromRoomId, toRoomId) {
  return STAIRS_BY_ROOM_PAIR.get(`${fromRoomId}->${toRoomId}`) ?? null
}
