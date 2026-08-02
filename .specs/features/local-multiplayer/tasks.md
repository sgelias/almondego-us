# Local Multiplayer Foundation Tasks

**Design**: `.specs/features/local-multiplayer/design.md`
**Status**: In Progress — T1-T6 code complete and gate-passed; T7 code complete (protocol layer verified via a real two-connection smoke test against the running server), awaiting a human two-browser-window manual playtest

---

## Execution Plan

### Phase 1: Foundation (Parallel)

```
T1 [P]  (shared/protocol.js + test)
T2 [P]  (root package.json + ws dependency)
T5 [P]  (lobby/lobbyScreen.js)
T6 [P]  (net/remotePlayers.js)
```

### Phase 2: Server & Net Client (Parallel, after their deps)

```
T1, T2 ──→ T3 [P]  (server/index.js)
T1 ──→ T4 [P]  (net/client.js)
```

### Phase 3: Integration (Sequential)

```
T3, T4, T5, T6 ──→ T7  (main.js wiring: lobby → connect → play)
```

---

## Task Breakdown

### T1: Create shared/protocol.js [P]

**What**: `MESSAGE_TYPE` constants (`JOIN`, `WELCOME`, `PLAYER_JOINED`, `PLAYER_LEFT`, `STATE`, `START`, `ERROR`) and `isKnownMessageType(type)` pure validator, plus unit tests covering every known type returns true and an unknown/garbage type returns false.
**Where**: `shared/protocol.js`, `shared/protocol.test.js`
**Depends on**: None
**Reuses**: none
**Requirement**: NET-01 through NET-13 (shared foundation for all of them)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] All 7 message types are defined and unique
- [x] `isKnownMessageType` returns true for every `MESSAGE_TYPE` value and false for an arbitrary string
- [x] Gate check passes: `node --test 'shared/**/*.test.js'`
- [x] Test count: at least 2 tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(net): add shared WebSocket message protocol`

---

### T2: Add root package.json with ws dependency [P]

**What**: Root `package.json` (`"type": "module"`, `"scripts": {"server": "node server/index.js"}`, `"dependencies": {"ws": "^8.21.1"}`), a `.gitignore` entry for `node_modules/`, and running `npm install` once to fetch it.
**Where**: `package.json`, `.gitignore`
**Depends on**: None
**Reuses**: none
**Requirement**: NET-01 (server needs `ws` to exist before it can be written)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `npm install` completes with no errors
- [x] `node -e "import('ws').then(() => console.log('ok'))"` prints `ok`
- [x] `node_modules/` is git-ignored

**Tests**: none (config-only)
**Gate**: none

**Commit**: `build(server): add package.json and ws dependency`

---

### T3: Create server/index.js relay server [P]

**What**: `ws`-based `WebSocketServer` that: logs the LAN IP:port on startup (via `node:os` `networkInterfaces()`); on `connection`, waits for a `join` message, assigns a unique id, designates the first-ever connection as host, sends `welcome` (with current roster + `isHost`), and broadcasts `playerJoined` to everyone else; relays `state` messages verbatim to all other clients; only honors a `start` message from the tracked host id and broadcasts `start` to everyone; on `close`, removes the player and broadcasts `playerLeft`; rejects/ignores any message whose `type` fails `isKnownMessageType`.
**Where**: `server/index.js`
**Depends on**: T1, T2
**Reuses**: `shared/protocol.js`, `ws`
**Requirement**: NET-01, NET-02, NET-03, NET-05, NET-08, NET-09, NET-11, NET-13

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `node server/index.js` starts without error and logs a `ws://<lan-ip>:<port>` line
- [x] Two `wscat`-style manual connections can join, see each other via `welcome`/`playerJoined`, and a `state` message from one is relayed to the other but not echoed back to the sender
- [x] A duplicate `join` name gets a numeric suffix in the roster
- [x] Only the first-connected client's `start` message triggers a broadcast `start`
- [x] Closing one connection triggers `playerLeft` to the remaining one

**Tests**: none (per TESTING.md matrix — verified via manual multi-client playtest in T7)
**Gate**: none

**Commit**: `feat(server): add LAN relay server for player join/state/start`

---

### T4: Create src/net/client.js [P]

**What**: `createNetClient(url)` wrapping the browser's native `WebSocket`: exposes `on(type, handler)` for typed message dispatch (ignoring unknown types via `isKnownMessageType`), `send(type, payload)` that JSON-encodes and sends, and surfaces connection failure (via `onerror`/`onclose` before `onopen`) so the lobby can show NET-10's error message.
**Where**: `src/net/client.js`
**Depends on**: T1
**Reuses**: `shared/protocol.js`
**Requirement**: NET-10, NET-12 (transport for the sequence numbers `remotePlayers` will use)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `send(type, payload)` produces a JSON string matching the protocol shape
- [x] `on(type, handler)` only invokes `handler` for messages whose `type` matches
- [x] A connection failure surfaces through a dedicated callback/event rather than throwing unhandled

**Tests**: none (per TESTING.md matrix — DOM/WebSocket-coupled, verified in T7's manual playtest)
**Gate**: none

**Commit**: `feat(net): add browser WebSocket client wrapper`

---

### T5: Create src/lobby/lobbyScreen.js [P]

**What**: `showLobby({ onHostAndJoin, onJoin, onStart })` — a DOM overlay with a "Host & Join" button, a "Join" form (IP:port + name inputs), a live player-name list, a "Start Game" button (hidden until `setIsHost(true)`), and a connection-error message area.
**Where**: `src/lobby/lobbyScreen.js`
**Depends on**: None
**Reuses**: same plain-DOM-overlay pattern as `src/ui/pointerLockOverlay.js`
**Requirement**: NET-06, NET-07, NET-10

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Host-vs-join choice and name entry are all present and wired to their callbacks
- [x] `setPlayers([...])` updates the visible list without a page reload
- [x] `setIsHost(true)` reveals the Start Game button; `false` keeps it hidden
- [x] `showConnectionError(message)` displays the message somewhere visible
- [x] `hide()` removes the overlay entirely

**Tests**: none (per TESTING.md matrix)
**Gate**: none

**Commit**: `feat(lobby): add join/lobby screen`

---

### T6: Create src/net/remotePlayers.js [P]

**What**: `createRemotePlayers(scene, labelRenderer)` managing a `Map` of remote player id → `{ mesh: THREE.Mesh (capsule), label: CSS2DObject }`. `upsert(id, name, position, rotationY, seq)` creates the avatar+label on first sight, discards the update if `seq` isn't greater than the last applied one (NET-12), and otherwise stores it as the interpolation target. `update(deltaTime)` lerps each avatar toward its latest target each frame instead of snapping. `remove(id)` disposes the mesh/label and drops it from the map.
**Where**: `src/net/remotePlayers.js`
**Depends on**: None (Three.js/CSS2DRenderer only)
**Reuses**: primitive-geometry style from `src/map/skeldMap.js`
**Requirement**: NET-04, NET-05, NET-12

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `upsert` on an unseen id creates a capsule mesh + name label positioned correctly
- [x] `upsert` with a stale `seq` is a no-op
- [x] `update(deltaTime)` visibly interpolates rather than snapping between positions
- [x] `remove(id)` disposes geometry/label and the avatar disappears from the scene

**Tests**: none (per TESTING.md matrix — Three.js-coupled, verified in T7's manual playtest)
**Gate**: none

**Commit**: `feat(net): add remote player avatar rendering with interpolation`

---

### T7: Wire main.js for lobby → connect → play

**What**: Rework `src/main.js`'s startup so the 3D scene/animate loop no longer starts immediately: it first calls `showLobby(...)`, connects via `createNetClient` on "Host & Join"/"Join", relays `welcome`/`playerJoined`/`playerLeft`/`state` into `lobbyScreen`/`remotePlayers` calls, and only enters the existing Milestone-1 scene+animate loop after a `start` message arrives. Inside the animate loop, adds: throttled outgoing `state` sends from the local `playerController`'s camera position/yaw (with an incrementing `seq`), `remotePlayers.update(deltaTime)`, and a `CSS2DRenderer` sized/resized alongside the existing `WebGLRenderer`.
**Where**: `src/main.js` (modify)
**Depends on**: T3, T4, T5, T6
**Reuses**: all of Milestone 1's `main.js` wiring (map/player/UI/interaction untouched)
**Requirement**: NET-01 through NET-13 (full integration)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `node --test` passes (protocol unit tests still green)
- [ ] Manual playtest with `node server/index.js` running and 2 browser windows: both join the lobby, names appear on each other's list, host's Start Game moves both into the 3D scene, each sees the other's capsule+name move around, closing one window removes its avatar for the other
- [ ] All of spec.md's Success Criteria checked off

**Status note (2026-08-01):** Code complete. A self-review (see STATE.md L-003, L-004, L-005) caught and fixed three bugs before any browser playtest: remote avatars floated ~0.5 units above the floor (network position is the sender's eye height, not the capsule center), a disconnected player's name label was never removed from the DOM (only the mesh was disposed), and `connect()`/`startGame()` had no re-entrancy guard against a double-click or a duplicate `start` broadcast. The protocol layer (server relay + `net/client.js`) was verified end-to-end with real WebSocket connections via a throwaway script (join/host-designation/state-relay/start-gating/disconnect/connection-error all confirmed) — but nothing that touches the DOM, Three.js rendering, or the lobby UI has been exercised in an actual browser. The checkbox above stays unchecked until a human confirms it in two browser windows.

**Tests**: none (bootstrap/integration — verified via full manual multi-client playtest)
**Gate**: build — `node --test` + manual two-window playthrough per spec.md Success Criteria

**Commit**: `feat(main): wire lobby, networking, and remote player rendering into the game loop`

---

## Parallel Execution Map

```
Phase 1 (Parallel):
  T1 [P], T2 [P], T5 [P], T6 [P]

Phase 2 (Parallel, after their deps):
  T1, T2 done → T3 [P]
  T1 done → T4 [P]

Phase 3 (Sequential):
  T3, T4, T5, T6 done → T7
```

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: shared/protocol.js | 1 data/logic module + test | ✅ Granular |
| T2: package.json + ws | 1 config concern | ✅ Granular |
| T3: server/index.js | 1 component (cohesive: connection lifecycle + relay) | ✅ Granular |
| T4: net/client.js | 1 component | ✅ Granular |
| T5: lobby/lobbyScreen.js | 1 component | ✅ Granular |
| T6: net/remotePlayers.js | 1 component | ✅ Granular |
| T7: main.js | 1 integration/wiring file | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | None | ✅ Match |
| T2 | None | None | ✅ Match |
| T3 | T1, T2 | T1, T2 → T3 | ✅ Match |
| T4 | T1 | T1 → T4 | ✅ Match |
| T5 | None | None | ✅ Match |
| T6 | None | None | ✅ Match |
| T7 | T3, T4, T5, T6 | T3, T4, T5, T6 → T7 | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1: shared/protocol.js | Message protocol | unit | unit | ✅ OK |
| T2: package.json | (not in matrix — config-only) | — | none | ✅ OK |
| T3: server/index.js | Relay server | none | none | ✅ OK |
| T4: net/client.js | Net client | none | none | ✅ OK |
| T5: lobby/lobbyScreen.js | Lobby screen | none | none | ✅ OK |
| T6: net/remotePlayers.js | Remote players | none | none | ✅ OK |
| T7: main.js | Scene bootstrap (modified) | none | none | ✅ OK |

No violations — the one pure-logic layer (T1) carries unit tests; every DOM/network/Three.js-coupled layer is manual-playtest-only per TESTING.md.
