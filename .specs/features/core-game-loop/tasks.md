# Core Game Loop Tasks

**Design**: `.specs/features/core-game-loop/design.md`
**Status**: COMPLETE (2026-08-02) — T1-T13 done, all unit tests green, and the full 4+ browser-window manual playtest confirmed by the user. See T13's status note below.

---

## Execution Plan

### Phase 1: Foundation (Parallel)

```
T1  [P]  (shared/taskPool.js + test)
T2  [P]  (shared/ventPool.js + test)
T3  [P]  (shared/protocol.js extension + test update)
T5  [P]  (interactSystem.js: add getTarget)
T6  [P]  (playerController.js: add setFrozen)
T8  [P]  (game/roleUI.js)
T10 [P]  (game/meetingUI.js)
T11 [P]  (game/gameOverScreen.js)
```

### Phase 2: Game Rules & Map Decoration (Parallel, after their deps)

```
T1        ──→ T4 [P]  (server/gameState.js + tests)
T1, T2    ──→ T7 [P]  (skeldMap.js: place task/vent markers)
T5        ──→ T9 [P]  (game/taskInteraction.js)
```

### Phase 3: Server Wiring (Sequential)

```
T2, T3, T4 ──→ T12  (server/index.js wiring)
```

### Phase 4: Integration (Sequential)

```
T6, T7, T8, T9, T10, T11, T12 ──→ T13  (main.js full wiring + manual playtest)
```

---

## Task Breakdown

### T1: Create shared/taskPool.js [P]

**What**: `TASK_LOCATIONS` — 5 fixed task location definitions (`id`, `roomId` matching `skeldRooms.js` ids, `offset` from that room's center, `label`), spread across Electrical/Navigation/Storage/Admin/Weapons. Unit tests: exactly 5 entries, unique ids, every `roomId` exists in `ROOM_LAYOUT`.
**Where**: `shared/taskPool.js`, `shared/taskPool.test.js`
**Depends on**: None
**Reuses**: `src/map/skeldRooms.js`'s `ROOM_LAYOUT` ids (imported for the test's room-id cross-check)
**Requirement**: GAME-02

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] 5 unique task ids, each with a valid `roomId` and a label
- [x] Gate check passes: `node --test 'shared/**/*.test.js'`
- [x] Test count: at least 3 tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(game): add shared task location pool`

---

### T2: Create shared/ventPool.js [P]

**What**: `VENT_LOCATIONS` (room-granularity vents grouped per the real Skeld's vent network: `[reactor, upperEngine, lowerEngine]`, `[electrical, medbay, security]`, `[admin, cafeteria]`, `[navigation, weapons, shields]`) and `getVentDestination(ventId)` — pure cyclic "next vent in the same group" lookup. Unit tests cover: 2-member and 3-member groups cycle correctly, and an unknown vent id returns `null`.
**Where**: `shared/ventPool.js`, `shared/ventPool.test.js`
**Depends on**: None
**Reuses**: `src/map/skeldRooms.js`'s `ROOM_LAYOUT` ids
**Requirement**: GAME-13

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Every group has 2+ vents; every `roomId` is valid
- [x] `getVentDestination` cycles correctly for both a 2-vent and a 3-vent group
- [x] `getVentDestination('unknown')` returns `null`
- [x] Gate check passes: `node --test 'shared/**/*.test.js'`
- [x] Test count: at least 4 tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(game): add shared vent pool with cyclic destination lookup`

---

### T3: Extend shared/protocol.js with game message types [P]

**What**: Add `ROLE`, `TELEPORT`, `TASK_COMPLETE`, `KILL`, `CALL_MEETING`, `VOTE`, `VENT`, `TASKS_PROGRESS`, `PLAYER_DIED`, `MEETING_STARTED`, `MEETING_RESULT`, `GAME_OVER` to `MESSAGE_TYPE`. Update the existing unit tests (they already iterate `Object.values(MESSAGE_TYPE)` generically, so no new test *cases* are needed, just confirm the existing ones still pass with more entries).
**Where**: `shared/protocol.js`, `shared/protocol.test.js` (verify only, likely unchanged)
**Depends on**: None
**Reuses**: existing `MESSAGE_TYPE`/`isKnownMessageType` pattern from Milestone 2
**Requirement**: GAME-01, GAME-03, GAME-05 through GAME-11, GAME-13 (transport for all of them)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] All 12 new types added, still unique across the full `MESSAGE_TYPE` object
- [x] Gate check passes: `node --test 'shared/**/*.test.js'`
- [x] Test count unchanged or higher, none removed

**Tests**: unit
**Gate**: quick

**Commit**: `feat(net): extend protocol with role/task/kill/meeting/vote message types`

---

### T4: Create server/gameState.js [P]

**What**: Pure match-rules module per design.md's interface (`createMatch`, `getRole`, `getAssignedTasks`, `completeTask`, `isAlive`, `recordDeath`, `checkWinCondition`, `startMeeting`/`endMeeting`, `castVote`, `tallyVotes`). Unit tests cover: exactly one impostor assigned regardless of player count (2 and 5 players), each crewmate gets exactly 3 distinct task ids from the 5-entry pool, `completeTask` reports `allDone` only once every assigned task is done, `checkWinCondition` returns `'crew'` when all crewmate tasks are done, returns `'impostor'` when living crew count ≤ living impostor count, returns `null` otherwise, `tallyVotes` ejects on strict majority, doesn't eject on a tie or a skip-majority, and correctly reports `wasImpostor`.
**Where**: `server/gameState.js`, `server/gameState.test.js`
**Depends on**: T1
**Reuses**: `shared/taskPool.js`'s `TASK_LOCATIONS`
**Requirement**: GAME-01, GAME-02, GAME-03, GAME-05, GAME-06, GAME-09, GAME-10, GAME-11, GAME-12

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Role assignment is always exactly 1 impostor for any player count ≥ 3 (tested with a seeded/injectable `randomFn` for determinism, and a documented regression test for the 2-player degenerate case)
- [x] Task assignment gives each crewmate exactly 3 distinct ids from the 5-entry pool
- [x] Win-condition edge cases (all-tasks-done, parity, neither) all covered
- [x] Vote tally handles majority/tie/skip-majority correctly
- [x] Gate check passes: `node --test 'server/**/*.test.js'`
- [x] Test count: at least 10 tests pass (17 pass, including a regression test added after a real smoke test found that a dead crewmate's unfinished tasks were blocking the task-win path — see STATE.md L-009)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(server): add pure game-state module for roles, tasks, votes, win conditions`

---

### T5: Extend interactSystem.js with getTarget [P]

**What**: Add `getTarget(): THREE.Object3D | null` to the object `createInteractSystem` returns — the same mesh (if any) the existing prompt logic already determined is in range and looked-at, exposed so other code can react to a key press/hold instead of only showing text.
**Where**: `src/interaction/interactSystem.js` (modify)
**Depends on**: None
**Reuses**: its own existing raycast result
**Requirement**: GAME-03, GAME-06, GAME-07, GAME-13 (all need to know "what am I looking at")

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `getTarget()` returns the same object the prompt is currently shown for, or `null` when nothing is targeted
- [x] Existing `update()` prompt behavior from Milestone 1 is unchanged (extended, not replaced: `createInteractSystem` also now takes an optional `getPromptText(target)` callback so main.js can suppress/customize the prompt per role and task assignment — see SPEC_DEVIATION comment in the file and STATE.md L-008)

**Tests**: none (per TESTING.md matrix)
**Gate**: none

**Commit**: `feat(interaction): expose current interact target for game logic`

---

### T6: Extend playerController.js with setFrozen [P]

**What**: Add `setFrozen(frozen: boolean)` — while frozen, `update()` skips physics/movement entirely (camera holds still) and `handleKeyDown`/`handleKeyUp`/`handleMouseMove` become no-ops, so a meeting can pause the player without touching the render loop.
**Where**: `src/player/playerController.js` (modify)
**Depends on**: None
**Reuses**: existing closure-based state
**Requirement**: GAME-07

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `setFrozen(true)` stops the camera from moving even with keys held/mouse moved
- [x] `setFrozen(false)` resumes normal control immediately (also gained `teleportTo(position)` for vent movement, discovered as needed during T13 wiring)

**Tests**: none (per TESTING.md matrix)
**Gate**: none

**Commit**: `feat(player): add frozen state for meetings`

---

### T7: Extend skeldMap.js to place task and vent markers [P]

**What**: `buildSkeldMap()` additionally builds one small mesh per `TASK_LOCATIONS` entry (`userData = { interactable: true, kind: 'task', taskId }`) and per `VENT_LOCATIONS` entry (`userData = { interactable: true, kind: 'vent', ventId }`), positioned at their room's center + offset. Returned `interactables` array now includes these alongside the Milestone-1 placeholder (which can be removed now that real interactables exist).
**Where**: `src/map/skeldMap.js` (modify)
**Depends on**: T1, T2
**Reuses**: existing room-center placement pattern, `TASK_LOCATIONS`, `VENT_LOCATIONS`
**Requirement**: GAME-02, GAME-13

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] 5 task meshes and one mesh per vent location exist in the returned group, each correctly tagged
- [x] `interactables` includes all of them
- [x] The old single placeholder interactable is removed (superseded)

**Tests**: none (per TESTING.md matrix — Three.js-coupled, verified in T13's manual playtest)
**Gate**: none

**Commit**: `feat(map): place task and vent markers from the shared pools`

---

### T8: Create src/game/roleUI.js [P]

**What**: `createRoleUI()` returning `{ showRole(role, taskLabels), updateProgress(completed, total), hide() }` — a brief role-reveal overlay, then (for Crewmates) a small persistent corner HUD listing task labels with a checkmark per completed one and a `completed/total` counter (shown to everyone per spec.md's P2 note that the Impostor also sees the counter).
**Where**: `src/game/roleUI.js`
**Depends on**: None
**Reuses**: plain-DOM-overlay pattern from `pointerLockOverlay.js`
**Requirement**: GAME-01, GAME-02, GAME-05

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `showRole` displays the correct role and (for Crewmate) task labels
- [x] `updateProgress` updates the visible counter without recreating the whole HUD
- [x] `hide()` removes everything (also gained `markTaskDone(taskId)`, a small SPEC_DEVIATION over design.md's signature)

**Tests**: none (per TESTING.md matrix)
**Gate**: none

**Commit**: `feat(game): add role reveal and task HUD`

---

### T9: Create src/game/taskInteraction.js [P]

**What**: `createTaskInteraction(interactSystem, assignedTaskIds, onComplete)` — each frame, checks `interactSystem.getTarget()`; if it's a task mesh whose `taskId` is in `assignedTaskIds` and not yet completed, accumulates hold-time while the interact key is down (resets on release or on losing the target), and calls `onComplete(taskId)` once the hold reaches ~2 seconds.
**Where**: `src/game/taskInteraction.js`
**Depends on**: T5
**Reuses**: `interactSystem.getTarget()`
**Requirement**: GAME-03, GAME-04

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Holding the interact key on an assigned, incomplete task for ~2s fires `onComplete` exactly once
- [x] Releasing early resets progress (no partial credit on a second attempt)
- [x] Looking at an unassigned or already-completed task, or not being a Crewmate, never fires `onComplete` (main.js additionally gates this on the local player still being alive and no meeting/game-over being active — see STATE.md L-008)

**Tests**: none (per TESTING.md matrix)
**Gate**: none

**Commit**: `feat(game): add hold-to-complete task interaction`

---

### T10: Create src/game/meetingUI.js [P]

**What**: `createMeetingUI({ onVote })` — full-screen overlay (same style family as `lobbyScreen.js`): `showDiscussion(seconds)` (countdown, no actions), `showVoting(livingPlayers, seconds)` (a vote button per living player + a Skip button, calling `onVote(targetId)` once and then disabling further votes), `showResult(ejectedName, wasImpostor)` (or "no one was ejected"), `hide()`.
**Where**: `src/game/meetingUI.js`
**Depends on**: None
**Reuses**: plain-DOM-overlay pattern from `lobbyScreen.js`
**Requirement**: GAME-07, GAME-08, GAME-09

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Discussion and voting phases render distinct content with a visible countdown
- [x] Clicking a player or Skip calls `onVote` exactly once, then disables further clicks
- [x] `showResult` clearly states the outcome, including the Impostor reveal when applicable

**Tests**: none (per TESTING.md matrix)
**Gate**: none

**Commit**: `feat(game): add meeting discussion/voting/result UI`

---

### T11: Create src/game/gameOverScreen.js [P]

**What**: `showGameOver(winner, impostorName)` — a single full-screen message: "Crewmates win!" or "Impostor wins!" plus "The Impostor was: {name}".
**Where**: `src/game/gameOverScreen.js`
**Depends on**: None
**Reuses**: plain-DOM-overlay pattern
**Requirement**: GAME-05, GAME-10, GAME-11

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Displays the correct winner text for both outcomes
- [x] Always reveals the Impostor's name regardless of how the match ended

**Tests**: none (per TESTING.md matrix)
**Gate**: none

**Commit**: `feat(game): add game-over screen`

---

### T12: Wire server/index.js for the full game loop

**What**: On `start` (with ≥3 players, else reply with an `error`), call `gameState.createMatch` and privately send each player their `role` message. Add handlers: `taskComplete` (validate alive+crewmate+assigned+incomplete, call `completeTask`, broadcast `tasksProgress`, check win → `gameOver` if done); `kill` (validate sender is alive Impostor and target is alive, `recordDeath`, broadcast `playerDied`, check win); `callMeeting` (validate `phase === 'playing'` and sender alive, `startMeeting`, broadcast `meetingStarted` with living roster, start a discussion `setTimeout` then a voting `setTimeout`); `vote` (validate alive + voting phase + valid target, `castVote`); on the voting timer (or once every living player has voted) call `tallyVotes`, `recordDeath` if ejected, broadcast `meetingResult`, check win, `endMeeting`; `vent` (validate alive Impostor, look up `getVentDestination`, reply `teleport` to sender only). Gate the existing `state` relay on `gameState.isAlive`. On `close`, if the disconnecting id is the Impostor mid-match, immediately broadcast `gameOver` with `winner: 'crew'`.
**Where**: `server/index.js` (modify)
**Depends on**: T2, T3, T4
**Reuses**: `server/gameState.js`, `shared/ventPool.js`, existing broadcast helpers
**Requirement**: GAME-01, GAME-03, GAME-05 through GAME-15

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] A throwaway multi-client script (same approach as Milestone 2's T3 verification) confirms: role assignment (exactly one impostor, private), task completion + progress broadcast + win-by-tasks, kill + death broadcast, meeting call + voting + ejection + win-by-ejection, parity win, vent teleport (Impostor only), and Impostor-disconnect-ends-game

**Tests**: none (per TESTING.md matrix — verified via a real multi-connection smoke script, same as Milestone 2's server task)
**Gate**: none

**Commit**: `feat(server): wire roles, tasks, kills, meetings, voting, and win conditions`

**Status note (2026-08-01):** Two parity bugs were found and fixed via real 2- and 4-player smoke tests before this was considered done — see STATE.md L-006 (raised `MIN_PLAYERS_TO_START` from 2 to 3) and L-007 (even 3 players can't reach a meeting after one kill; spec.md's Independent Test now requires 4+ clients). A third bug (dead crewmates' unfinished tasks permanently blocking the task-win path) was found via a targeted 4-player smoke test and fixed in `tasksSummary` — see STATE.md L-009. That fix itself introduced a fourth, subtler bug (a kill could hand the crew an unearned task-completion win) caught by a second advisor review; fixed by restricting `checkWinCondition`'s `allDone` check to the `TASK_COMPLETE` path only — see STATE.md L-011. Re-verified with two real 4-player smoke tests covering both task-completion orderings (kill-then-finish, and finish-then-kill).

---

### T13: Wire main.js for the full playable match

**What**: On the `role` message, call `roleUI.showRole` and construct `taskInteraction` with the assigned task ids; wire its `onComplete` to send `taskComplete`. On `tasksProgress`, update the HUD. On `playerDied`, if it's the local player show a brief death notice (movement continues locally, per design.md's simplification) — if it's a remote player, `remotePlayers.remove(id)` (already happens via existing `playerLeft`-style handling, extended to also trigger on `playerDied`). On `meetingStarted`, `player.setFrozen(true)` and drive `meetingUI` through discussion → voting, wiring its `onVote` to send `vote`. On `meetingResult`, show the result, then unfreeze (`setFrozen(false)`) unless the game just ended. On `gameOver`, freeze the player and show `gameOverScreen`. Wire the interact key (e.g. `KeyE` press for kill/report/vent, held for tasks) using `interactSystem.getTarget()`'s `userData.kind` to decide which message to send (`kill` if Impostor + target is a living remote player capsule; `callMeeting` if target is the emergency button or a body; `vent` if Impostor + target is a vent).
**Where**: `src/main.js` (modify)
**Depends on**: T6, T7, T8, T9, T10, T11, T12
**Reuses**: all of Milestones 1-2's existing wiring, extended rather than replaced
**Requirement**: GAME-01 through GAME-15 (full integration)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `node --test` passes (all prior unit tests still green — 39 total)
- [x] Manual playtest with 4+ browser windows: roles are assigned and private; the Crewmate(s) can complete tasks and see the shared progress counter; completing all tasks ends the match as a Crewmate win; separately, the Impostor can kill, the Cafeteria emergency button can call a meeting, a meeting runs discussion→voting→ejection, ejecting the Impostor ends the match as a Crewmate win, and reducing living Crewmates to parity ends it as an Impostor win; a dead player keeps moving locally but is invisible to the others; the Impostor can vent — confirmed by the user (2026-08-02)
- [x] All of spec.md's Success Criteria checked off

**Tests**: none (bootstrap/integration — verified via full manual multi-client playtest)
**Gate**: build — `node --test` + manual 4+-window playthrough per spec.md Success Criteria

**Commit**: `feat(main): wire the full role/task/kill/meeting/voting/win-condition game loop`

**Status note (2026-08-01):** Code complete; all server-side/protocol logic verified via real multi-client smoke-test scripts (never the browser — this session has no browser tooling). A self-review pass (prompted by the advisor tool, per project convention) caught four more bugs before handoff, none of which unit tests or `node --check` could catch since they're DOM/game-flow-integration issues:
- A dead Crewmate's still-incomplete tasks stayed in `tasksSummary`'s denominator forever (the server independently rejects `taskComplete` from the dead via `isAlive`), permanently blocking the task-completion win path after any death. Fixed by excluding dead players from `tasksSummary` (STATE.md L-009) — but that exclusion alone let a kill shrink the denominator into an unearned crew win the moment the last behind-on-tasks Crewmate died. Fixed by restricting the `allDone` check to only ever run from the `TASK_COMPLETE` path, never from kill/ejection/disconnect (STATE.md L-011). Re-verified with two real 4-player smoke tests: kill-then-finish (task win still reachable after a death) and finish-then-kill (a kill alone never wins it).
- `MEETING_STARTED` froze the player but never released the Pointer Lock API's mouse capture, so clicks could never reach `meetingUI`'s vote buttons. Fixed by calling `document.exitPointerLock()` on both `MEETING_STARTED` and `GAME_OVER` (STATE.md L-008).
- A dead player's client kept running `taskInteraction.update` and could still send `kill`/`vent`/`callMeeting` client-side (the server would silently drop them, but the local UI would misleadingly show a task/kill as having "succeeded"). Fixed with a `localAlive` flag gating both (STATE.md L-008).
- The interact prompt showed "Press E to interact" for every hit regardless of role/assignment, contradicting GAME-04/GAME-13's "no prompt" requirement, and said "Press" for tasks that actually need a 2s hold. Fixed by giving `interactSystem` an optional `getPromptText(target)` callback that main.js uses to suppress/customize the text per role and task-assignment state (STATE.md L-008).

**Confirmed (2026-08-02):** The user ran the full 4-browser-window playtest and reported everything working ("tudo funcionando") — all three win paths, meeting/voting flow, and vent movement.

---

## Parallel Execution Map

```
Phase 1 (Parallel):
  T1 [P], T2 [P], T3 [P], T5 [P], T6 [P], T8 [P], T10 [P], T11 [P]

Phase 2 (Parallel, after their deps):
  T1 done       → T4 [P]
  T1, T2 done   → T7 [P]
  T5 done       → T9 [P]

Phase 3 (Sequential):
  T2, T3, T4 done → T12

Phase 4 (Sequential):
  T6, T7, T8, T9, T10, T11, T12 done → T13
```

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: shared/taskPool.js | 1 data module + test | ✅ Granular |
| T2: shared/ventPool.js | 1 data module + 1 pure function + test | ✅ Granular |
| T3: protocol.js extension | 1 constant object extended | ✅ Granular |
| T4: server/gameState.js | 1 cohesive module (match rules) + tests | ✅ Granular |
| T5: interactSystem.js getTarget | 1 method addition | ✅ Granular |
| T6: playerController.js setFrozen | 1 method addition | ✅ Granular |
| T7: skeldMap.js markers | 1 builder extension | ✅ Granular |
| T8: game/roleUI.js | 1 component | ✅ Granular |
| T9: game/taskInteraction.js | 1 component | ✅ Granular |
| T10: game/meetingUI.js | 1 component | ✅ Granular |
| T11: game/gameOverScreen.js | 1 component | ✅ Granular |
| T12: server/index.js wiring | 1 integration file | ✅ Granular |
| T13: main.js wiring | 1 integration file | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | None | ✅ Match |
| T2 | None | None | ✅ Match |
| T3 | None | None | ✅ Match |
| T4 | T1 | T1 → T4 | ✅ Match |
| T5 | None | None | ✅ Match |
| T6 | None | None | ✅ Match |
| T7 | T1, T2 | T1, T2 → T7 | ✅ Match |
| T8 | None | None | ✅ Match |
| T9 | T5 | T5 → T9 | ✅ Match |
| T10 | None | None | ✅ Match |
| T11 | None | None | ✅ Match |
| T12 | T2, T3, T4 | T2, T3, T4 → T12 | ✅ Match |
| T13 | T6, T7, T8, T9, T10, T11, T12 | T6, T7, T8, T9, T10, T11, T12 → T13 | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1: shared/taskPool.js | Task pool data | unit | unit | ✅ OK |
| T2: shared/ventPool.js | Vent pool data + lookup | unit | unit | ✅ OK |
| T3: shared/protocol.js | Message protocol | unit | unit | ✅ OK |
| T4: server/gameState.js | Game rules | unit | unit | ✅ OK |
| T5: interactSystem.js | Interact system (modified) | none | none | ✅ OK |
| T6: playerController.js | Player controller (modified) | none | none | ✅ OK |
| T7: skeldMap.js | Map geometry builder (modified) | none | none | ✅ OK |
| T8: game/roleUI.js | Role/task HUD | none | none | ✅ OK |
| T9: game/taskInteraction.js | Task interaction | none | none | ✅ OK |
| T10: game/meetingUI.js | Meeting UI | none | none | ✅ OK |
| T11: game/gameOverScreen.js | Game over screen | none | none | ✅ OK |
| T12: server/index.js | Server wiring (modified) | none | none | ✅ OK |
| T13: main.js | Scene bootstrap (modified) | none | none | ✅ OK |

No violations — the four pure-logic layers (T1, T2, T3, T4) carry unit tests; every DOM/Three.js/network-wiring layer is manual-playtest-only per TESTING.md.
