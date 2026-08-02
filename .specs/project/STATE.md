# State

**Last Updated:** 2026-08-02
**Current Work:** v1 (all 3 milestones) is complete and playtest-confirmed. The user then asked for three more things, in this order: (1) make the game playable solo/duo by filling empty slots with bots, (2) translate the in-game UI to Portuguese, (3) a major visual/aesthetic overhaul (explicitly sequenced *after* bots). Mid-request, the user also reported the map had floor holes and nonsensical room/corridor shapes - that turned out to be a real, structural geometry bug (not cosmetic), fixed first since both the Portuguese pass and especially the bots depend on a correct map. See AD-006 and L-012 below. Bots feature (`bot-players`) is next up for Specify/Design/Tasks.

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

### AD-006: Room layout data moved to shared/ (2026-08-02)

**Decision:** `skeldRooms.js` (and its test) moved from `src/map/` to `shared/`, alongside `taskPool.js`/`ventPool.js`.
**Reason:** `server/index.js` already reached into `src/map/skeldRooms.js` for `ventPosition`'s room lookup - a client-only directory being imported by the server was already a leaky boundary. The upcoming bot-players feature makes this load-bearing: the server needs `ROOM_LAYOUT`'s connection graph directly to path bots between rooms, so the reach-across needed to become a legitimate shared module rather than staying an exception.
**Trade-off:** None meaningful - it's pure data + a pure test, no Three.js/DOM coupling, so the move is a straight relocation (import path updates only).
**Impact:** `shared/` is now the single source of truth for map topology (`skeldRooms.js`), plus task/vent placement (`taskPool.js`, `ventPool.js`) and the corridor geometry derived from it (`corridorRouting.js`, new - see L-012). `src/map/skeldMap.js` (Three.js mesh building) is the only piece that stays client-only.

---

## Active Blockers

None currently blocking. Next planned work: Specify/Design/Tasks for the `bot-players` feature (fill empty lobby slots with AI-controlled players, target 6 total, elaborate behavior per user's discuss answers), then a Portuguese localization pass, then a future aesthetics milestone.

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

### L-006: A win-condition formula needs to be checked against its own boundary inputs, not just typical ones (2026-08-01)

**Context:** `server/gameState.js`'s `checkWinCondition` declares the Impostor the winner once living crew count ≤ living impostor count (1) — the standard Among Us parity rule. `server/index.js` originally allowed a match to start with as few as 2 connected players (1 impostor + 1 crewmate).
**Problem:** With exactly 2 players, `checkWinCondition` returns `'impostor'` the instant the match is created — living crew (1) ≤ living impostors (1) — before either player has done anything. This was invisible to the unit tests (which happened to always test with 3+ players) and only surfaced via a real 2-player smoke test.
**Solution:** Raised `MIN_PLAYERS_TO_START` to 3 (1 impostor + 2 crewmates, so parity isn't hit at kickoff) and added a regression test (`gameState.test.js`: "with only 2 players, checkWinCondition is impostor-favored from the start") documenting exactly why.
**Prevents:** Any win/loss formula with a "count A vs. count B" shape needs its degenerate/boundary inputs (smallest possible roster, all-but-one-eliminated, etc.) checked explicitly — a formula that's obviously correct for a "normal" game size can be trivially true or false at the boundary.

### L-007: Fixing a boundary bug doesn't mean the next-smallest case is safe too (2026-08-01)

**Context:** After L-006 raised the minimum to 3 players, a follow-up real 4-player smoke test was run to verify the full kill→meeting→vote→eject path.
**Problem:** Even with exactly 3 players (1 impostor + 2 crew), a single kill drops living crew to 1 — hitting the same parity condition from L-006 immediately, before any meeting can be called. The P2 acceptance path (kill, then call a meeting, then vote out the Impostor) is structurally unreachable with only 3 players; the match always ends by parity first.
**Solution:** Corrected spec.md's P2 "Independent Test" to require 4+ clients explicitly, with an inline note explaining why 3 isn't enough. `MIN_PLAYERS_TO_START` itself stays at 3 (a 3-player game is still valid — it just can only end by parity, not by a meeting).
**Prevents:** After fixing one boundary case, re-derive what the *next* boundary case actually allows rather than assuming "N+1 must be fine" — parity-style win conditions in particular tend to have more than one degenerate roster size.

### L-008: A frozen player and a locked pointer are two different kinds of "can't act" — freezing movement doesn't unlock the mouse (2026-08-01)

**Context:** `MEETING_STARTED` calls `player.setFrozen(true)` and shows `meetingUI`'s vote buttons as an HTML overlay, while pointer lock (acquired at game start for FPS-style mouselook) is still held by the canvas.
**Problem:** Under the Pointer Lock API, all mouse events are still routed to the locked element, not whatever the OS cursor visually sits over — so a click on a vote button would never actually reach it, and the OS cursor stays hidden the whole time. A tester with no prior warning could only vote by independently guessing "press Esc first." Separately, a dead player's client kept calling `taskInteraction.update()` every frame and could still dispatch `kill`/`vent`/`callMeeting` on an interact press — the server silently drops these (correctly), but the local UI (e.g. `roleUI.markTaskDone`) would have already reacted as if it succeeded, showing a lie on that player's own screen. And the interact prompt showed a generic "Press E to interact" for every raycast hit regardless of role or task assignment (contradicting GAME-04/GAME-13's "no prompt for invalid interactions" requirement) and said "Press" for tasks that actually require a 2-second hold.
**Solution:** `MEETING_STARTED`/`GAME_OVER` now call `document.exitPointerLock()` (the existing pointer-lock overlay's own "click to resume" flow handles regaining it, since browsers require a user gesture to re-lock). A `localAlive` flag (set false on the local player's own `PLAYER_DIED`/ejection) and an `interactionsPaused` flag (true during meetings/game-over) now gate both `handleInteractPress` and the per-frame `taskInteraction.update` call. `interactSystem.createInteractSystem` gained an optional `getPromptText(target)` callback so `main.js` can suppress the prompt entirely (unassigned/completed tasks, Crewmate looking at a vent or another player) and give each valid case the correct verb ("Hold" for tasks, "Press" for kill/vent/meeting).
**Prevents:** When a UI state change is meant to disable player action ("frozen", "dead", "game over"), enumerate every distinct capture layer that could still let input through — physics freeze, pointer lock, per-frame update loops, and prompt/affordance text are four separate places the same "can't act right now" fact has to be applied, and missing any one of them either silently breaks the feature (unclickable vote buttons) or lets the client lie to its own player.

### L-009: A "living players only" rule stated in prose needs to actually be enforced in the aggregate the win check reads (2026-08-01)

**Context:** spec.md's GAME-05 says "WHEN every **living** Crewmate has completed all 3 of their assigned tasks..." — but `server/gameState.js`'s `tasksSummary` originally iterated `match.tasksByPlayer` unconditionally, including dead players.
**Problem:** The server already rejects `taskComplete` from a dead player (via the `isAlive` gate in `server/index.js`), so a dead Crewmate's assigned-but-incomplete tasks stayed in `tasksSummary`'s `total` forever with no way to move to `completed`. After any death, `allDone` could never become true again — the entire task-completion win path (GAME-05, the P1 MVP criterion) was silently unreachable for the rest of the match. The existing smoke tests never caught this because the 4-player run that included a kill went straight to the meeting/voting path afterward, never circling back to re-test the task-win path with a death already on the board.
**Solution:** `tasksSummary` now skips any `playerId` not in `match.alive`, so a dead Crewmate's tasks are excluded from both `total` and `completed` entirely rather than staying as permanent unfinished debt. Added a regression test and re-verified with a real 4-player smoke test: kill a crewmate mid-task, have the survivors finish their own lists, confirm `gameOver` still fires with `winner: 'crew'`. **This exclusion alone turned out to reopen a different bug the same day — see L-011 for the follow-up fix that was needed on top of it.**
**Prevents:** When a spec sentence says "every living X", grep the implementation for the aggregate that decides the outcome (here, `tasksSummary`) and confirm it actually filters by the same aliveness check the rest of the code already enforces elsewhere — two code paths silently disagreeing on "does this dead player still count" is easy to miss because each one looks correct in isolation.

### L-010: Extending a fixed-array component into a dynamic one is a signature change, not just a call-site change (2026-08-01)

**Context:** Milestone 1's `interactSystem.js` and `remotePlayers.js` were both designed around Milestone 1/2's static scope: a fixed list of map interactables, and remote avatars that only needed to be drawn, not targeted.
**Problem:** Milestone 3 needs the Impostor to raycast against other players (to kill) and the interact target list has to include meshes that come and go as players join/die mid-match — a snapshot array captured once at scene-build time can't reflect that.
**Solution:** `createInteractSystem(camera, interactables)` became `createInteractSystem(camera, getInteractables)` (a callback re-read every frame instead of a fixed array); `remotePlayers.js` tags each avatar mesh with `userData = { interactable: true, kind: 'player', killTargetId: id }` and exposes `getMeshes()` so `main.js` can compose `[...staticInteractables, ...remotePlayers.getMeshes()]` fresh each frame. `playerController.js` also gained `teleportTo(position)` for vent movement, and design.md's separate "reportable body" prop at a kill site was dropped as a scope trim (the Cafeteria emergency button already gives every living player the same "call a meeting" capability design.md needed a body for) — documented inline in spec.md rather than silently dropped.
**Prevents:** When a later milestone needs a component to react to a set that changes over the component's lifetime (not just at construction), a fixed-array/fixed-value constructor argument needs to become a callback/getter rather than being re-derived from scratch — treat this as a designed API change (with a SPEC_DEVIATION note) rather than a quiet patch.

### L-011: Excluding a dead player from a shared aggregate can make removing them look like *finishing* it (2026-08-01)

**Context:** L-009's fix made `tasksSummary` skip dead players entirely, so `total` shrinks by exactly that player's task count the moment they die.
**Problem:** A second advisor review traced a real sequence this enables: the two on-time Crewmates finish all their tasks while a third Crewmate ("the laggard") has done none of theirs — `tasksSummary` correctly reports not-done. The Impostor then kills the laggard. `tasksSummary` now only iterates the two survivors, who are both fully done — `allDone` flips to `true`, and `checkWinCondition` declares a Crewmate win **caused by the kill itself**, not by anyone finishing a task. This is a direct contradiction of the "every living Crewmate has completed all tasks" rule (GAME-05/GAME-06): the Impostor's own kill would be handing the crew the win.
**Solution:** `checkWinCondition(match, { checkTasks = true })` — the kill, ejection, and disconnect paths in `server/index.js` now all call it with `checkTasks: false`, so the `allDone` branch is only ever reachable from the actual `TASK_COMPLETE` handler. A death can still change the *parity* outcome (as it always could), but it can never by itself complete the task-win condition. Verified with two real 4-player smoke tests: killing the laggard *after* the survivors finish no longer ends the match, while the survivors' own subsequent task completions still can.
**Prevents:** Filtering a dead entity out of a shared aggregate (a count, a total, a "still pending" set) can silently turn "removing someone from consideration" into "counting as done" if the code path that reacts to the aggregate crossing a threshold doesn't distinguish *why* it changed. When an aggregate can change because of two different kinds of event (a completion vs. a removal), gate which event types are allowed to trigger the downstream consequence, rather than trusting the aggregate's current value alone.

### L-012: Drawing a corridor as "a straight line between two centers" only works when every connection happens to be cardinal (2026-08-02)

**Context:** The user reported the map had holes in the floor and rooms with "shapes that don't make sense." `skeldMap.js`'s original corridor builder computed the exact point where a straight line between two room centers crosses each room's own rectangular boundary, then drew a single box between those two points, rotated to match the line's angle.
**Problem:** An advisor review traced this precisely on real data: for `cafeteria→storage` (a diagonal pair), the corridor's near edge is a tilted line crossing through the boundary-exit point, but the room's floor ends at a straight, axis-aligned line - the wedge of ground between the tilted edge and the straight edge belongs to neither, leaving an unfloored gap the player falls through (caught by `FALL_RESPAWN_Y`, which is why it read as "falls into the void" rather than a visible crash). Separately, the wall gap cut for the corridor was always exactly `CORRIDOR_WIDTH` wide, but a corridor meeting the wall at an angle needs a *wider* opening (`CORRIDOR_WIDTH / cos(angle)`) to actually admit its own width - so the leftover wall stub intruded into the corridor mouth at an angle, which is the "shape that doesn't make sense." Of this layout's 24 room-to-room connections, 12 are diagonal - this wasn't an edge case, it was most of the map. One connection (`upperEngine`-`reactor`) had a second, independent problem: the two rooms sit in a straight line with `lowerEngine` physically between them, so even a "fixed" straight corridor would tunnel through a third room's walls.
**Solution:** Rewrote corridor generation from "derive a line between centers" to "author a rectilinear route and build only axis-aligned geometry from it" (`shared/corridorRouting.js`, new, pure/unit-tested). Each connection resolves to a chain of waypoints via a 4-directional grid BFS that treats every *other* room (padded by half the corridor width) as a blocked obstacle - so a path that would cut through a third room automatically detours around it instead. `upperEngine-reactor` needed a manual override (the BFS solution was valid but a hand-picked route reads more sensibly) - see `CORRIDOR_OVERRIDES` in `skeldMap.js`. Every wall gap and corridor segment is now built from a coordinate that's guaranteed axis-aligned, so gap width always exactly matches corridor width with no trig involved. Verified two ways: unit tests assert every corridor segment is axis-aligned, boundary-exact, and clips no third room; a throwaway script then walked every corridor's centerline in 5%-steps and confirmed floor coverage at every sampled point (0 gaps found, previously would have found several).
**Prevents:** A geometry generator derived from "the straight line between two reference points" is only correct if every pair of reference points is guaranteed to be cardinally aligned - check that invariant against the *actual* data (not just a couple of example pairs) before trusting a rotated/derived shape to fit a hand-authored, axis-aligned counterpart (room floors/walls, in this case). When it doesn't hold for a meaningful fraction of the data, author the route (or synthesize it with a real pathfinder) instead of deriving it from raw endpoints.

---

## Quick Tasks Completed

None yet.

---

## Deferred Ideas

None yet — captured in PROJECT.md "Explicitly out of scope" instead (multiple maps, cosmetics, voice chat, mobile controls, internet play).

---

## Todos

None. All Milestone 1-3 playtest items are closed out (confirmed 2026-08-02).

---

## Preferences

**Model Guidance Shown:** never
