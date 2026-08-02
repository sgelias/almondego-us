# State

**Last Updated:** 2026-08-01
**Current Work:** Milestone 1 (First-Person Movement Core) is COMPLETE. Milestone 2 (Local Multiplayer Foundation, feature `local-multiplayer`) is code-complete (T1-T7) — the protocol/server/client layer is verified end-to-end via real WebSocket connections (a throwaway script, not the browser), but nothing DOM/Three.js-facing (lobby UI, remote avatar rendering) has run in an actual browser yet. Blocked only on a human two-browser-window playtest — see tasks.md status note.

---

## Recent Decisions (Last 60 days)

### AD-001: Real 3D via Three.js instead of raycasting engine (2026-08-01)

**Decision:** Use Three.js (WebGL) for real 3D rendering instead of a classic Doom-style raycasting engine.
**Reason:** User explicitly chose "3D real com Three.js" over the raycasting options.
**Trade-off:** Heavier runtime than a raycaster; requires basic 3D math/scene graph knowledge over 2D grid math.
**Impact:** Map, collision, and rendering tasks will be built around Three.js scenes, meshes, and cameras.

### AD-002: LAN multiplayer via WebSocket, not single-player/hot-seat (2026-08-01)

**Decision:** v1 targets real multiplayer over local network (Node.js + `ws` server), not single-player-vs-bots or same-keyboard hot-seat.
**Reason:** User explicitly chose "Multiplayer via rede local (WebSocket/WebRTC)".
**Trade-off:** Significant added complexity — server-authoritative state, network sync, lobby — before core gameplay can be tested with more than one person.
**Impact:** Roadmap splits movement/rendering (Milestone 1) from networking (Milestone 2) so the first-person feel can be validated solo before multiplayer complexity is added.

### AD-003: No client build step (2026-08-01)

**Decision:** Client is vanilla JS with ES modules, no bundler (Vite/Webpack/etc.).
**Reason:** User chose "HTML/JS puro, sem build" explicitly as recommended option.
**Trade-off:** No hot-reload dev server convenience; must manage script loading order/CDN or vendored Three.js manually.
**Impact:** Three.js must be included via CDN `<script type="importmap">` or a vendored local copy, not npm+bundler.

### AD-004: Full essential game loop targeted for v1 (2026-08-01)

**Decision:** v1 scope includes the complete core loop: movement, tasks, impostor kill/vent, emergency meetings, voting, win/loss — not a reduced exploration-only slice.
**Reason:** User chose "Loop completo essencial" explicitly.
**Trade-off:** Larger overall scope; will need Design + Tasks phases (not quick mode) given the architectural surface (networking + game state machine + 3D rendering).
**Impact:** ROADMAP.md splits this into 3 milestones so each is independently shippable/testable rather than one giant feature.

### AD-005: Optimize for maintainability/extensibility, not speed of first build (2026-08-01)

**Decision:** Every design/implementation from here on should draw module boundaries along the seams later milestones will actually need (single state ownership per concern, clean wiring points), without writing unused speculative code for features not yet built.
**Reason:** User explicitly asked: "Escreva ele do jeito que facilite a manutenção e extensibilidade posterior" (write it so it's easy to maintain/extend later).
**Trade-off:** Slightly more upfront thought about module boundaries per feature; still must avoid over-engineering (no empty folders/types for unbuilt features — that would violate the "no speculative abstractions" default).
**Impact:** First-person-movement design.md's components (`map`, `player`, `ui`, `interaction`) are deliberately decoupled so Milestone 2 (networking) and Milestone 3 (game loop) can be added by wiring new modules in `main.js`, not by rewriting existing ones. Apply the same lens to every future design.md.

---

## Active Blockers

None. (T9's manual playtest is tracked as an open Done-when item in tasks.md, not a blocker — the code path to unblock it is just "user plays it in a browser".)

---

## Lessons Learned

### L-001: A physics constant's name can hide which quantity it actually controls (2026-08-01)

**Context:** `playerController.js` reused the official Three.js `games_fps.html` capsule-collision pattern, which applies a named "speed" constant as an input to an exponential-damping model (`playerVelocity.addScaledVector(playerVelocity, exp(-4*dt)-1)`), not as a direct velocity.
**Problem:** Named it `WALK_SPEED = 5` and set it by intuition ("5 feels like a reasonable meters/second"). Under that damping model, terminal velocity converges to roughly `value / 4` — so the real top speed was ~1.25 u/s in an ~80-unit map, nowhere near the "moderate FPS pace" the user asked for. `node --check` and the unit tests couldn't catch this because it's a tuning/semantic bug, not a syntax or pure-logic bug — it only surfaced via manual derivation (and would have surfaced immediately in a playtest).
**Solution:** Renamed to `WALK_ACCELERATION` (accurately describing its role) and derived the value from the target terminal speed (`target * 4 ≈ 20`) instead of guessing at the surface number.
**Prevents:** When reusing a physics/animation pattern from reference code, identify which quantity each constant actually drives (acceleration vs. velocity vs. position) before choosing its value — the variable's *name* in the source you're copying from is a hypothesis to verify, not a fact.

### L-002: "Remove the whole wall" is the wrong granularity when connections are diagonal (2026-08-01)

**Context:** `skeldMap.js`'s room layout (`skeldRooms.js`) places all 14 rooms on a grid spaced only to guarantee non-overlap, without regard to which rooms connect to which — so most connections in `ROOM_LAYOUT` end up diagonal rather than sharing an axis.
**Problem:** The first `buildRoom()` implementation mapped each connection to one of 4 cardinal sides and omitted the *entire* wall on that side. For a diagonal connection, the corridor only physically covers a narrow strip near the exact attachment point — so the rest of that "open" wall had no wall AND no floor behind it. Walking along it dropped the player into the void with no recovery path (no OOB respawn existed either). This was invisible to `node --check` and the unit tests (matrix correctly marks this file as manual-playtest-only) — it needed either a real playtest or someone reasoning through the geometry by hand.
**Solution:** Replaced whole-wall removal with per-connection door-sized gaps, positioned by the exact point where the corridor line crosses the room's boundary (`computeEdge`, shared by both the wall-gap logic and the corridor-placement logic, so they can't drift out of sync). Also restored the `games_fps.html` out-of-bounds respawn as a safety net for whatever this approach still misses.
**Prevents:** When room/corridor placement isn't grid-aligned, "which whole side is open" is the wrong question — the right question is "where exactly does the connecting geometry touch this room's boundary." Any future map work (Milestone 3 room additions, a second map) should reuse `computeEdge` rather than re-deriving a cardinal-side approximation.

### L-003: The network "position" and the render mesh's origin need the same reference point (2026-08-01)

**Context:** `main.js` broadcasts `camera.position` (the local player's eye height, sitting at the top of their capsule) as each player's networked "position". `remotePlayers.js` drew the remote capsule mesh directly at that y-coordinate.
**Problem:** `CapsuleGeometry` is centered on its own origin, so "eye position" and "capsule center" are two different points ~0.5 units apart. Every remote player rendered floating half a unit above the floor. Nothing in the unit tests or `node --check` could catch this — it's a semantic mismatch between what one module sends and what another assumes, only visible by actually looking at the rendered scene.
**Solution:** `remotePlayers.js` now subtracts a documented `EYE_TO_CENTER_OFFSET` constant before placing/lerping the mesh, converting the network's "eye position" into the visual "capsule center" it actually needs.
**Prevents:** When one module's output becomes another's input across a network boundary, write down (in a comment or the design doc) exactly *what point on the body* a position number represents — "position" alone is ambiguous between eye, feet, and center, and the mismatch is invisible until rendered.

### L-004: Removing a parent from the scene does not cascade cleanup to `CSS2DObject` children (2026-08-01)

**Context:** `remotePlayers.remove(id)` needed to fully clean up a disconnected player's capsule mesh and its `CSS2DObject` name-tag label (added as a child of the mesh).
**Problem:** The first version only called `scene.remove(entry.mesh)` and disposed the mesh's geometry — never touching the label. `CSS2DObject` relies on a `'removed'` event fired when *it itself* is detached from its direct parent; removing an ancestor further up the tree doesn't propagate that event down to it. The result: the mesh disappeared correctly, but the player's name text stayed frozen on screen at its last position forever.
**Solution:** Store the label reference on the tracked entry and explicitly detach it (`entry.mesh.remove(entry.label)`) plus remove its DOM element directly, rather than relying on cleanup cascading from an ancestor removal.
**Prevents:** Whenever a Three.js object owns a `CSS2DObject`/other DOM-backed child, cleanup code must reach that specific child directly — removing an ancestor is not equivalent to removing it, even though both leave the scene graph looking correct.

### L-005: Any user-triggered async action needs a re-entrancy guard, even a "just wire it up" one (2026-08-01)

**Context:** `main.js`'s `connect()` (fired by clicking a lobby button) and `startGame()` (fired by a network `start` message) both had side effects — opening a socket, adding `requestAnimationFrame`/input listeners — that are wrong to run twice.
**Problem:** Neither had a guard. A double-click on "Host & Join" (there's no "connecting…" loading state yet) would have opened a second socket and sent a second `join`, leaving a phantom entry in everyone's roster forever. A duplicate `start` broadcast (a narrow race that widens with LAN latency) would have started a second `animate()` loop stacked on the first — doubling movement speed and mouse sensitivity, not just doubling CPU work.
**Prevents:** Any handler wired to a UI click or an incoming network message that has non-idempotent side effects (opening a connection, starting a loop, attaching listeners) needs an explicit "already in progress/already done" guard — "the user won't do that" and "the message won't arrive twice" are both assumptions worth guarding against for free.

---

## Quick Tasks Completed

None yet.

---

## Deferred Ideas

None yet — captured in PROJECT.md "Explicitly out of scope" instead (multiple maps, cosmetics, voice chat, mobile controls, internet play).

---

## Todos

- [ ] Get user's manual two-browser-window playtest of `local-multiplayer` (T7's second Done-when box). Needs TWO processes: terminal 1 `npm run server` (logs the LAN address, default port 8080), terminal 2 a static file server from the project root (e.g. `python3 -m http.server 8843`) for the client. Window A: "Host & Join". Window B: type `localhost:8080` (same machine) or the LAN address terminal 1 printed (different machine) into the join field.
- [ ] On playtest pass: mark T7 fully done in tasks.md, flip spec.md's NET-04..NET-13 statuses to Verified, update ROADMAP.md's Milestone 2 features to COMPLETE
- [ ] Design phase for Milestone 3 (Core Game Loop: roles, tasks, impostor kill/vent, meetings/voting, win/loss) — the shared relay server and protocol from Milestone 2 should extend with new message types rather than needing a new transport layer

---

## Preferences

**Model Guidance Shown:** never
