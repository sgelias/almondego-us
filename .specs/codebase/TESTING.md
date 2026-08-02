# Testing Infrastructure

**Status:** Greenfield decision (2026-08-01) — no existing tests to analyze yet. This documents the convention going forward, per explicit user choice: unit tests for pure logic only; rendering/movement feel is verified by manual playtesting, not automated.

## Test Frameworks

**Unit:** Node.js built-in test runner (`node:test` + `node:assert`) — no extra dependency needed.
**Integration:** None planned.
**E2E:** None — WebGL/pointer-lock automation was explicitly declined as not worth the setup cost for this project.
**Coverage:** No coverage tool configured.

## Test Organization

**Location:** Co-located with source — `src/path/to/module.js` → `src/path/to/module.test.js`
**Naming:** `*.test.js` suffix
**Structure:** One test file per pure-logic module; `describe`/`test` blocks from `node:test`

## Testing Patterns

### Unit Tests

**Approach:** Only modules that are pure functions or pure data (no Three.js scene/renderer/DOM coupling) get unit tests — e.g. room layout data validation, movement-vector math (diagonal normalization, pitch clamping).
**Location:** Next to the module they test.

### Integration / E2E Tests

Not used in this project. Rendering, collision-in-the-actual-scene, mouselook feel, and multiplayer sync (once built) are verified by running the app in a browser and playing it — see `validate.md`'s interactive UAT process for user-facing/complex-behavior features.

## Test Execution

**Commands:** (verified against Node v24.18.0 — passing a bare directory to `--test` does not glob-discover files on this version, so use no-args auto-discovery or an explicit glob)

- Run all unit tests: `node --test` (auto-discovers every `*.test.js` recursively from cwd)
- Run one area: `node --test 'src/map/**/*.test.js'`
- Run a single file: `node --test src/map/skeldRooms.test.js`

**Configuration:** None — Node's built-in runner needs no config file.

## Coverage Targets

**Current:** N/A (no tests yet)
**Goal:** Every pure-logic module (data validation, math helpers) has at least one test covering its core behavior and its documented edge cases.
**Enforcement:** Manual — no CI configured for this local hobby project.

## Test Coverage Matrix

| Code Layer | Required Test Type | Location Pattern | Run Command |
| --- | --- | --- | --- |
| Room layout data (`src/map/skeldRooms.js`) | unit | `src/map/skeldRooms.test.js` | `node --test 'src/map/**/*.test.js'` |
| Movement math — diagonal normalization, pitch clamp (`src/player/movementMath.js`) | unit | `src/player/movementMath.test.js` | `node --test 'src/player/**/*.test.js'` |
| Map geometry builder (`src/map/skeldMap.js`) | none | — | manual playtest |
| World collider wrapper (`src/map/worldOctree.js`) | none | — | manual playtest |
| Player controller (`src/player/playerController.js`) | none | — | manual playtest |
| Pointer lock overlay (`src/ui/pointerLockOverlay.js`) | none | — | manual playtest |
| Interact system (`src/interaction/interactSystem.js`) | none | — | manual playtest |
| Scene bootstrap (`src/main.js`) | none | — | manual playtest |
| Message protocol (`shared/protocol.js`) | unit | `shared/protocol.test.js` | `node --test 'shared/**/*.test.js'` |
| Relay server (`server/index.js`) | none | — | manual playtest (2+ browser clients) |
| Net client (`src/net/client.js`) | none | — | manual playtest |
| Remote players (`src/net/remotePlayers.js`) | none | — | manual playtest |
| Lobby screen (`src/lobby/lobbyScreen.js`) | none | — | manual playtest |

## Parallelism Assessment

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --- | --- | --- | --- |
| unit | Yes | Pure functions/data, no shared state, no I/O | Modules take inputs and return outputs only — no globals, no DOM, no network |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | After tasks with unit tests only | `node --test` |
| Full | After tasks touching Three.js/DOM-coupled code (no automated e2e exists) | `node --test` + manual playtest per Done-when criteria |
| Build | After phase completion | `node --test` + full manual playthrough of the milestone's vertical slice |
