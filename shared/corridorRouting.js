// Pure geometry: turns ROOM_LAYOUT's logical `connections` graph into
// axis-aligned corridor paths. Every path is a rectilinear chain of
// waypoints (each consecutive pair shares an x or a z coordinate), found by
// a grid BFS that treats every room *other* than the two endpoints as a
// blocked obstacle (padded by half the corridor width) - so a corridor
// between two rooms with nothing sensible in a straight or single-bend line
// between them still finds a path that goes around, rather than tunneling
// through a third room's walls.
//
// This replaces an earlier version that drew a single rotated segment
// straight between room centers: for any diagonal pair, that segment
// crossed its own room's boundary at an angle, leaving a floor gap between
// the axis-aligned room edge and the tilted corridor mouth, and a wall gap
// sized for the corridor's width instead of its (wider) projection along
// the wall. A follow-up single-bend-only version still left 11 of the 24
// connections unroutable, because this room layout is dense enough that
// even the natural "L" turn clips a third room in many cases. See STATE.md
// L-012.

const GRID_STEP = 1
const GRID_MARGIN = 5

function roomBounds(room) {
  const [cx, , cz] = room.center
  const [w, , d] = room.size
  return { xMin: cx - w / 2, xMax: cx + w / 2, zMin: cz - d / 2, zMax: cz + d / 2 }
}

function computeMapBounds(rooms) {
  let xMin = Infinity
  let xMax = -Infinity
  let zMin = Infinity
  let zMax = -Infinity
  for (const room of rooms) {
    const b = roomBounds(room)
    xMin = Math.min(xMin, b.xMin)
    xMax = Math.max(xMax, b.xMax)
    zMin = Math.min(zMin, b.zMin)
    zMax = Math.max(zMax, b.zMax)
  }
  return { xMin: xMin - GRID_MARGIN, xMax: xMax + GRID_MARGIN, zMin: zMin - GRID_MARGIN, zMax: zMax + GRID_MARGIN }
}

// Marks every grid cell that falls inside any room in `rooms` (other than
// `excludeIds`), padded by half the corridor width so a centerline path
// through the remaining open cells is guaranteed to keep the full-width
// corridor clear of those rooms.
function buildBlockedGrid(rooms, excludeIds, corridorWidth, bounds) {
  const halfWidth = corridorWidth / 2
  const cols = Math.round((bounds.xMax - bounds.xMin) / GRID_STEP) + 1
  const rows = Math.round((bounds.zMax - bounds.zMin) / GRID_STEP) + 1
  const blocked = new Uint8Array(cols * rows)

  for (const room of rooms) {
    if (excludeIds.has(room.id)) continue
    const b = roomBounds(room)
    const iMin = Math.max(0, Math.ceil((b.xMin - halfWidth - bounds.xMin) / GRID_STEP))
    const iMax = Math.min(cols - 1, Math.floor((b.xMax + halfWidth - bounds.xMin) / GRID_STEP))
    const jMin = Math.max(0, Math.ceil((b.zMin - halfWidth - bounds.zMin) / GRID_STEP))
    const jMax = Math.min(rows - 1, Math.floor((b.zMax + halfWidth - bounds.zMin) / GRID_STEP))
    for (let j = jMin; j <= jMax; j += 1) {
      for (let i = iMin; i <= iMax; i += 1) blocked[j * cols + i] = 1
    }
  }

  return { blocked, cols, rows }
}

function toGridIndex(x, z, bounds) {
  return {
    i: Math.round((x - bounds.xMin) / GRID_STEP),
    j: Math.round((z - bounds.zMin) / GRID_STEP),
  }
}

function toWorld(i, j, bounds) {
  return [bounds.xMin + i * GRID_STEP, bounds.zMin + j * GRID_STEP]
}

// 4-directional BFS from roomA's center to roomB's center over the blocked
// grid. Returns a world-space waypoint list (still center-to-center; the
// caller converts the endpoints to actual room-boundary crossing points)
// simplified down to its bends, or null if no path exists at all (would
// mean a room is fully sealed off by every other room - not expected to
// happen with this layout, but a silent infinite corridor is worse than a
// loud failure).
export function routeCorridor(roomA, roomB, allRooms, corridorWidth) {
  const bounds = computeMapBounds(allRooms)
  const { blocked, cols, rows } = buildBlockedGrid(allRooms, new Set([roomA.id, roomB.id]), corridorWidth, bounds)

  const [ax, , az] = roomA.center
  const [bx, , bz] = roomB.center
  const start = toGridIndex(ax, az, bounds)
  const goal = toGridIndex(bx, bz, bounds)

  const startIdx = start.j * cols + start.i
  const goalIdx = goal.j * cols + goal.i
  const prev = new Int32Array(cols * rows).fill(-1)
  const visited = new Uint8Array(cols * rows)
  visited[startIdx] = 1
  const queue = [startIdx]
  let head = 0

  while (head < queue.length) {
    const current = queue[head]
    head += 1
    if (current === goalIdx) break
    const ci = current % cols
    const cj = Math.floor(current / cols)

    const neighbors = [
      [ci + 1, cj],
      [ci - 1, cj],
      [ci, cj + 1],
      [ci, cj - 1],
    ]
    for (const [ni, nj] of neighbors) {
      if (ni < 0 || ni >= cols || nj < 0 || nj >= rows) continue
      const nIdx = nj * cols + ni
      if (visited[nIdx] || blocked[nIdx]) continue
      visited[nIdx] = 1
      prev[nIdx] = current
      queue.push(nIdx)
    }
  }

  if (!visited[goalIdx]) return null

  const rawPath = []
  let cursor = goalIdx
  while (cursor !== -1) {
    rawPath.push(cursor)
    cursor = prev[cursor]
  }
  rawPath.reverse()

  const points = rawPath.map((idx) => toWorld(idx % cols, Math.floor(idx / cols), bounds))

  // Collapse runs of collinear steps into their endpoints only.
  const simplified = [points[0]]
  for (let k = 1; k < points.length - 1; k += 1) {
    const [px, pz] = points[k - 1]
    const [cx, cz] = points[k]
    const [nx, nz] = points[k + 1]
    const sameDirection = (cx - px === nx - cx) && (cz - pz === nz - cz)
    if (!sameDirection) simplified.push(points[k])
  }
  simplified.push(points[points.length - 1])

  return simplified
}

// Converts a waypoint chain's center-to-center endpoints into the actual
// point where the corridor crosses that room's rectangular boundary, so the
// corridor floor/walls start exactly at the wall rather than at the room's
// center. Interior bend points are left untouched.
export function corridorExitPoint(room, towardX, towardZ) {
  const [cx, , cz] = room.center
  const [w, , d] = room.size
  if (towardZ === cz) {
    const x = towardX > cx ? cx + w / 2 : cx - w / 2
    return [x, cz]
  }
  const z = towardZ > cz ? cz + d / 2 : cz - d / 2
  return [cx, z]
}

// Computes every unique connection's waypoint chain, with actual room-
// boundary endpoints (not centers). Throws if a pair has no route at all
// and isn't covered by `overrides` - a silently-dropped corridor would be
// worse than a loud build-time failure.
export function computeCorridors(roomLayout, corridorWidth, overrides = {}) {
  const corridors = []
  const seen = new Set()

  for (const room of roomLayout) {
    for (const connectionId of room.connections) {
      const pairKey = [room.id, connectionId].sort().join('->')
      if (seen.has(pairKey)) continue
      seen.add(pairKey)

      const other = roomLayout.find((r) => r.id === connectionId)
      const override = overrides[pairKey]
      const waypoints = override ?? routeCorridor(room, other, roomLayout, corridorWidth)

      if (!waypoints) {
        throw new Error(`No route between "${room.id}" and "${other.id}" - add an override in skeldCorridors.js`)
      }

      const second = waypoints[1]
      const secondToLast = waypoints[waypoints.length - 2]

      const points = [...waypoints]
      points[0] = corridorExitPoint(room, second[0], second[1])
      points[points.length - 1] = corridorExitPoint(other, secondToLast[0], secondToLast[1])

      corridors.push({ roomAId: room.id, roomBId: other.id, points })
    }
  }

  return corridors
}
