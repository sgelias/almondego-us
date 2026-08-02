# Bot Players Tasks

**Design**: `.specs/features/bot-players/design.md`
**Status**: In Progress - T1-T6 code complete, unit tests green (69 total), and a full solo-human + 5-bot match verified end-to-end via smoke test. Awaiting a browser playtest for the visual half.

---

## Execution Plan

```
Phase 1 (Parallel):
  T1 [P]  shared/navGraph.js + tests
  T2 [P]  server/gameActions.js (extract inline handlers, no behavior change)
  T3 [P]  server/botBrain.js + tests

Phase 2 (Sequential):
  T1, T2, T3 ──▶ T4  server/botRunner.js
  T2, T4     ──▶ T5  server/index.js wiring (min players 1, spawn bots, delegate)
  T5         ──▶ T6  full-match smoke test
```

---

## Task Breakdown

### T1: Create shared/navGraph.js [P]

**What**: `createNavGraph(roomLayout, corridors)` returning `roomIdAt(x, z)`, `findRoomPath(from, to)`, `waypointsTo(fromPosition, toRoomId, toOffset)`, `randomAdjacentRoom(roomId, randomFn)` per design.md. Unit tests: every room pair is reachable; a returned waypoint polyline is fully axis-aligned and starts/ends where expected; `roomIdAt` correctly identifies room interiors and returns `null` in corridors.
**Where**: `shared/navGraph.js`, `shared/navGraph.test.js`
**Depends on**: None
**Reuses**: `shared/skeldRooms.js`, `shared/corridorRouting.js`
**Requirement**: BOT-04, BOT-05

**Done when**:
- [x] `findRoomPath` connects any two of the 14 rooms
- [x] `waypointsTo` returns an axis-aligned polyline beginning at the given position
- [x] `roomIdAt` distinguishes room interior from corridor
- [x] Gate check passes: `node --test 'shared/**/*.test.js'`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(nav): add pure navigation graph for room pathing`

---

### T2: Extract server/gameActions.js [P]

**What**: Move the `taskComplete`/`kill`/`callMeeting`/`vote`/`vent` handler bodies out of `index.js`'s `socket.on('message')` into `createGameActions(deps)` returning `doTaskComplete`/`doKill`/`doCallMeeting`/`doVote`/`doVent`, each taking `playerId` instead of `socket`. **Verbatim logic move - no behavior change.** `index.js`'s handlers become one-line delegations.
**Where**: `server/gameActions.js` (new), `server/index.js` (modify)
**Depends on**: None
**Reuses**: `server/gameState.js`, existing broadcast helpers
**Requirement**: BOT-02

**Done when**:
- [x] All five actions live in `gameActions.js` and take `playerId`
- [x] `index.js` message handlers only parse + delegate
- [x] The existing `core-game-loop` multi-client smoke test still passes byte-for-byte in behavior (regression check for the extraction)

**Tests**: none (pure refactor - covered by re-running the existing smoke tests)
**Gate**: smoke

**Commit**: `refactor(server): extract game actions so bots and humans share one code path`

---

### T3: Create server/botBrain.js [P]

**What**: `createBotBrain(botId, randomFn)` with the memory-write and decision API from design.md. **Must never accept or import match state.** Unit tests cover the BOT-11 priority order and, critically, that a brain with an empty sighting log does *not* reliably pick the impostor.
**Where**: `server/botBrain.js`, `server/botBrain.test.js`
**Depends on**: None
**Reuses**: nothing (fully self-contained pure module)
**Requirement**: BOT-08, BOT-09, BOT-10, BOT-11, BOT-12

**Done when**:
- [x] Witnessed killer beats witnessed venter beats last-seen-with beats random
- [x] A brain with no sightings votes randomly/skips (statistically not the impostor)
- [x] `shouldCallMeeting` is false before the reaction delay, true after (renamed from `shouldReportKill` during T6 - see spec.md BOT-12)
- [x] Gate check passes: `node --test 'server/**/*.test.js'`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(bots): add pure bot decision brain with witness-limited memory`

---

### T4: Create server/botRunner.js

**What**: The 15 Hz simulation loop per design.md: owns bot positions, advances them along `navGraph` waypoints, broadcasts `state`, performs task holds / kills / vents through `gameActions`, fans witnessed kill/vent events out to in-range brains only, and schedules bot votes during meetings.
**Where**: `server/botRunner.js`
**Depends on**: T1, T2, T3
**Reuses**: `shared/navGraph.js`, `server/gameActions.js`, `server/botBrain.js`, `shared/taskPool.js`, `shared/ventPool.js`
**Requirement**: BOT-03, BOT-04, BOT-05, BOT-06, BOT-07, BOT-12

**Done when**:
- [x] Bots move along corridors at human walk speed and broadcast `state` at 15 Hz
- [x] Crewmate bots complete tasks; Impostor bot kills only when alone with one target, respects a cooldown, and vents occasionally
- [x] Sensing only notifies brains whose bot was actually in range
- [x] Bots freeze during meetings and cast a vote within the voting window

**Tests**: none (loop/timing integration - verified in T6)
**Gate**: none

**Commit**: `feat(bots): add server-side bot simulation loop`

---

### T5: Wire server/index.js for bots

**What**: `MIN_PLAYERS_TO_START` 3 → 1; on `START`, spawn `6 - players.size` bots (named from a fixed pool, announced via normal `playerJoined`) before `createMatch` runs over the combined roster; record each human's latest `state` position so bot sensing can see them; start/stop the bot tick with the match.
**Where**: `server/index.js` (modify)
**Depends on**: T2, T4
**Reuses**: `server/botRunner.js`, `server/gameActions.js`
**Requirement**: BOT-01, BOT-02, BOT-03, BOT-13

**Done when**:
- [x] Starting with 1 human produces a 6-player match with 5 bots
- [x] Starting with 6+ humans adds no bots
- [x] Bots appear in every client's roster indistinguishably from humans

**Tests**: none (transport wiring - verified in T6)
**Gate**: none

**Commit**: `feat(server): fill empty lobby slots with bots up to six players`

---

### T6: Full bot-match smoke test

**What**: A throwaway multi-client script (same approach as prior milestones) that connects 1 real client, starts the match, and verifies over a real run: 5 bots join, roles are assigned across all 6, bots broadcast moving `state`, `tasksProgress` advances from bot task completions, and the match reaches a `gameOver` on its own. Plus a scripted-witness check for BOT-11.
**Where**: throwaway script, deleted after use
**Depends on**: T5
**Requirement**: All BOT-*

**Done when**:
- [x] A solo-human match runs start-to-finish and ends with a valid `gameOver`
- [x] Bot positions actually change over time (not frozen at spawn)
- [x] `node --test` still fully green

**Tests**: none (integration smoke)
**Gate**: build

**Commit**: (verification only - folded into T5's commit or a fix commit if it finds bugs)

---

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 navGraph | Pure map/path logic | unit | unit | ✅ OK |
| T2 gameActions | Server action logic (extracted) | none (smoke) | none (smoke) | ✅ OK |
| T3 botBrain | Pure decision logic | unit | unit | ✅ OK |
| T4 botRunner | Loop/timing integration | none | none | ✅ OK |
| T5 index.js | Transport wiring | none | none | ✅ OK |
