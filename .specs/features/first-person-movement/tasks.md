# First-Person Movement Tasks

**Design**: `.specs/features/first-person-movement/design.md`
**Status**: Draft

---

## Execution Plan

### Phase 1: Foundation (Parallel)

```
T1 [P]  (index.html scaffold)
T2 [P]  (skeldRooms.js data + test)
T3 [P]  (movementMath.js + test)
```

### Phase 2: Core Geometry & UI shell (Parallel, after their deps)

```
T2 ──→ T4 [P]  (skeldMap.js)
T1 ──→ T7 [P]  (pointerLockOverlay.js)
```

### Phase 3: Collision & Interaction (Parallel, after T4)

```
T4 ──→ T5 [P]  (worldOctree.js)
T4 ──→ T8 [P]  (interactSystem.js)
```

### Phase 4: Player Controller (Sequential)

```
T3, T5 ──→ T6  (playerController.js)
```

### Phase 5: Integration (Sequential)

```
T1, T5, T6, T7, T8 ──→ T9  (main.js wiring + full manual playtest)
```

---

## Task Breakdown

### T1: Create index.html scaffold [P]

**What**: `index.html` with a Three.js `importmap` (pinned CDN version, mapping `three` and `three/addons/`), a full-viewport `<canvas>`, and a `<script type="module" src="src/main.js">` entry point.
**Where**: `index.html`
**Depends on**: None
**Reuses**: Official Three.js `importmap` pattern (verified in research notes)
**Requirement**: FPM-01

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Page loads in a browser via a static file server with no console errors
- [ ] Canvas fills the viewport
- [ ] `three` and `three/addons/` resolve correctly from the importmap

**Tests**: none
**Gate**: none — visually confirmed once `main.js` exists (T9)

**Commit**: `feat(scaffold): add index.html with three.js importmap`

---

### T2: Create skeldRooms.js layout data [P]

**What**: `ROOM_LAYOUT` array covering The Skeld's rooms (Cafeteria, Weapons, Navigation, O2, Shields, Communications, Storage, Electrical, Upper Engine, Lower Engine, Security, Reactor, Medbay, Admin) as `RoomDef` objects (`id`, `center`, `size`, `connections`) per design.md's Data Models section, plus a unit test validating every `connections` reference is symmetric and points to an existing room id.
**Where**: `src/map/skeldRooms.js`, `src/map/skeldRooms.test.js`
**Depends on**: None
**Reuses**: `RoomDef` shape from design.md
**Requirement**: FPM-01

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] All 14 Skeld rooms present with center/size/connections
- [ ] Gate check passes: `node --test 'src/map/**/*.test.js'`
- [ ] Test count: at least 2 tests pass (symmetric connections, no dangling ids)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(map): add Skeld room layout data`

---

### T3: Create movementMath.js pure functions [P]

**What**: `normalizeMovementVector(forward, right)` and `clampPitch(pitch)` pure functions per design.md, plus unit tests covering: cardinal input (no scaling), diagonal input (scaled to magnitude 1), zero input, and pitch clamping at/near ±90°.
**Where**: `src/player/movementMath.js`, `src/player/movementMath.test.js`
**Depends on**: None
**Reuses**: none
**Requirement**: FPM-03, FPM-09

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `normalizeMovementVector` never returns a vector with magnitude > 1
- [ ] `clampPitch` never returns a value at or beyond ±π/2
- [ ] Gate check passes: `node --test 'src/player/**/*.test.js'`
- [ ] Test count: at least 4 tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(player): add pure movement math helpers`

---

### T4: Create skeldMap.js map builder

**What**: `buildSkeldMap()` builds a `THREE.Group` of box geometry (floor/walls/ceiling) for each room in `ROOM_LAYOUT` and a corridor box between each connected pair, returns `{ group, spawnPoint, interactables }` with one placeholder interactable mesh (`userData.interactable = true`) somewhere in the map.
**Where**: `src/map/skeldMap.js`
**Depends on**: T2
**Reuses**: `src/map/skeldRooms.js` (`ROOM_LAYOUT`)
**Requirement**: FPM-01, FPM-07

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `buildSkeldMap()` returns a group containing geometry for all 14 rooms and their corridors
- [ ] `spawnPoint` is inside a room (Cafeteria, per Among Us convention), not inside geometry
- [ ] At least one mesh has `userData.interactable = true`

**Tests**: none (per TESTING.md matrix — Three.js-coupled, verified in T9's manual playtest)
**Gate**: none

**Commit**: `feat(map): build Skeld map geometry from room layout`

---

### T5: Create worldOctree.js [P]

**What**: `buildWorldOctree(mapGroup)` wrapping `new Octree().fromGraphNode(mapGroup)`.
**Where**: `src/map/worldOctree.js`
**Depends on**: T4
**Reuses**: `three/addons/math/Octree.js`, output of T4
**Requirement**: FPM-04

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `buildWorldOctree()` returns an `Octree` built from the map group
- [ ] No other module imports `Octree` directly (all access goes through this wrapper, per design.md's reuse strategy)

**Tests**: none (per TESTING.md matrix)
**Gate**: none

**Commit**: `feat(map): add world octree collision wrapper`

---

### T6: Create playerController.js

**What**: `createPlayerController(camera, worldOctree, spawnPoint)` implementing the `games_fps.html`-style capsule/gravity/collision loop (`STEPS_PER_FRAME` sub-stepping), sprint speed multiplier, head-bob, and mouselook using `movementMath.clampPitch` for pitch and `movementMath.normalizeMovementVector` for WASD input.
**Where**: `src/player/playerController.js`
**Depends on**: T3, T5
**Reuses**: `src/player/movementMath.js`, `three/addons/math/Capsule.js`, output of T5, `games_fps.html` pattern (research notes)
**Requirement**: FPM-02, FPM-03, FPM-04, FPM-05, FPM-06, FPM-09

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `update(deltaTime)` moves the camera per input, resolves collisions against the octree, and never lets the camera pass through map geometry
- [ ] Sprint key increases speed by a defined multiplier
- [ ] Head-bob is visible while moving and stops when idle
- [ ] Diagonal movement (W+D) is normalized via `movementMath`

**Tests**: none (per TESTING.md matrix — stateful, Three.js/DOM-coupled; its pure math is already covered by T3's tests)
**Gate**: none

**Commit**: `feat(player): add capsule-based first-person controller`

---

### T7: Create pointerLockOverlay.js [P]

**What**: `initPointerLockOverlay(domElement)` — an overlay shown by default, hidden on `pointerlockchange` when locked, and shown again on unlock (Esc/focus loss), per FPM-08.
**Where**: `src/ui/pointerLockOverlay.js`
**Depends on**: T1
**Reuses**: none
**Requirement**: FPM-08

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Overlay is visible on load
- [ ] Clicking the overlay requests pointer lock and hides it on success
- [ ] Overlay reappears automatically when pointer lock is lost

**Tests**: none (per TESTING.md matrix)
**Gate**: none

**Commit**: `feat(ui): add pointer lock overlay`

---

### T8: Create interactSystem.js [P]

**What**: `createInteractSystem(camera, interactables)` raycasting from screen center each frame; toggles a crosshair prompt when a ray hits an `interactable`-tagged mesh within range.
**Where**: `src/interaction/interactSystem.js`
**Depends on**: T4
**Reuses**: `THREE.Raycaster`, `interactables` list from T4's `buildSkeldMap()`
**Requirement**: FPM-07

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Prompt appears only when looking at an interactable within range
- [ ] Prompt disappears when out of range or looking away

**Tests**: none (per TESTING.md matrix)
**Gate**: none

**Commit**: `feat(interaction): add interact prompt raycast system`

---

### T9: Wire main.js and verify the full vertical slice

**What**: `src/main.js` creates the renderer/scene/camera/clock, calls `buildSkeldMap()`, `buildWorldOctree()`, `createPlayerController()`, `initPointerLockOverlay()`, `createInteractSystem()`, wires keyboard/mouse events to the player controller, handles `window.resize` (FPM-10), and runs the animation loop.
**Where**: `src/main.js`
**Depends on**: T1, T5, T6, T7, T8
**Reuses**: all prior components per design.md's Architecture Overview
**Requirement**: FPM-01 through FPM-10 (full integration)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `node --test` passes (all unit tests from T2, T3 still green)
- [ ] Manual playtest (per spec.md Independent Tests): pointer lock engages on click; player walks through at least two rooms and a corridor with no clipping; sprint and head-bob are visibly distinct from base walk; diagonal movement isn't faster than cardinal; Esc shows the resume overlay; interact prompt appears near the placeholder interactable; window resize doesn't distort the view
- [ ] All of spec.md's Success Criteria checked off

**Tests**: none (bootstrap/integration — verified via full manual playtest, no dedicated test file)
**Gate**: build — `node --test` + full manual playthrough per spec.md Success Criteria

**Commit**: `feat(main): wire scene, player, map, and UI into a playable vertical slice`

---

## Parallel Execution Map

```
Phase 1 (Parallel):
  T1 [P], T2 [P], T3 [P]

Phase 2 (Parallel, after their single dep):
  T2 done → T4 [P]
  T1 done → T7 [P]

Phase 3 (Parallel, after T4):
  T4 done → T5 [P]
  T4 done → T8 [P]

Phase 4 (Sequential):
  T3, T5 done → T6

Phase 5 (Sequential):
  T1, T5, T6, T7, T8 done → T9
```

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: index.html scaffold | 1 file | ✅ Granular |
| T2: skeldRooms.js data | 1 data module + test | ✅ Granular |
| T3: movementMath.js | 2 pure functions + test | ✅ Granular |
| T4: skeldMap.js | 1 builder function | ✅ Granular |
| T5: worldOctree.js | 1 wrapper function | ✅ Granular |
| T6: playerController.js | 1 component (cohesive: capsule + input + physics) | ✅ Granular |
| T7: pointerLockOverlay.js | 1 component | ✅ Granular |
| T8: interactSystem.js | 1 component | ✅ Granular |
| T9: main.js | 1 bootstrap/wiring file | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | None | ✅ Match |
| T2 | None | None | ✅ Match |
| T3 | None | None | ✅ Match |
| T4 | T2 | T2 → T4 | ✅ Match |
| T5 | T4 | T4 → T5 | ✅ Match |
| T6 | T3, T5 | T3, T5 → T6 | ✅ Match |
| T7 | T1 | T1 → T7 | ✅ Match |
| T8 | T4 | T4 → T8 | ✅ Match |
| T9 | T1, T5, T6, T7, T8 | T1, T5, T6, T7, T8 → T9 | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1: index.html | (not in matrix — markup, no logic) | — | none | ✅ OK |
| T2: skeldRooms.js | Room layout data | unit | unit | ✅ OK |
| T3: movementMath.js | Movement math | unit | unit | ✅ OK |
| T4: skeldMap.js | Map geometry builder | none | none | ✅ OK |
| T5: worldOctree.js | World collider wrapper | none | none | ✅ OK |
| T6: playerController.js | Player controller | none | none | ✅ OK |
| T7: pointerLockOverlay.js | Pointer lock overlay | none | none | ✅ OK |
| T8: interactSystem.js | Interact system | none | none | ✅ OK |
| T9: main.js | Scene bootstrap | none | none | ✅ OK |

No violations — every `none` is a Three.js/DOM-coupled layer the matrix explicitly marks as manual-playtest-only; both pure-logic layers (T2, T3) carry unit tests.
