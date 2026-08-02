# Bot Players Design

**Spec**: `.specs/features/bot-players/spec.md`

---

## Research Notes

**Where bots have to live.** A bot has no browser, so nothing can run its `playerController`/`animate` loop. The server has to own each bot's position and drive it on a tick. Everything a real client sends (`join`, `state`, `taskComplete`, `kill`, `callMeeting`, `vote`, `vent`) a bot must instead trigger directly inside the server.

**Existing constraint this creates.** Every one of those actions is currently written *inline inside the `socket.on('message')` handler*, reading `socket.playerId` and validating against `match`. A bot can't send a socket message to itself, so either (a) the logic gets duplicated for bots - which spec.md's BOT-02 explicitly forbids and which would drift the moment either copy changes - or (b) each action gets extracted into a `playerId`-taking function that both the socket handler and the bot driver call. (b) is the only option consistent with AD-005.

**Pathfinding is already solved by the L-012 map rework.** `shared/corridorRouting.js`'s `computeCorridors` already returns, for every room pair, the exact rectilinear waypoint chain connecting them - and it's in `shared/`, so the server imports it directly. A bot walking `room center → corridor waypoints → room center` never needs collision detection, because corridor centerlines are provably clear of every other room (`corridorRouting.test.js` asserts this) and rooms are open boxes. **No server-side Octree, no second pathfinder.** Verified by walking three multi-hop paths through the real data (cafeteria→reactor, medbay→communications, security→navigation) before committing to this approach.

**The omniscience constraint (spec.md P3) drives the module split.** The server object `match` contains `impostorId`. If bot decision code can reach `match`, someone will eventually read it "just for this one check" and the bots become unbeatable. The defense is structural, not disciplinary: **decision logic goes in a pure module that is never passed `match`** - it receives only a bot's own sighting log plus the public living-player roster, and returns a decision. There is no code path from decision logic to the answer key.

---

## Architecture

```
                      ┌──────────────────────┐
   human socket ─────▶│  server/index.js     │
                      │  (transport only)    │
                      └──────────┬───────────┘
                                 │ playerId + params
                                 ▼
                      ┌──────────────────────┐
                      │ server/gameActions.js│  ← single implementation of
                      │  doTaskComplete()    │    every game action; owns
                      │  doKill()            │    validation + broadcast +
                      │  doCallMeeting()     │    win check. Bots and humans
                      │  doVote()            │    both funnel through here.
                      │  doVent()            │
                      └──────────┬───────────┘
                                 ▲
                                 │ same calls, no socket
                      ┌──────────┴───────────┐
                      │ server/botRunner.js  │  ← owns bot positions, ticks
                      │  (simulation loop)   │    movement, broadcasts state,
                      └────┬────────────┬────┘    feeds sightings to brains
                           │            │
              ┌────────────▼──┐   ┌─────▼──────────────┐
              │ shared/       │   │ server/botBrain.js │
              │  navGraph.js  │   │  (PURE - never     │
              │  (PURE)       │   │   receives `match`)│
              └───────────────┘   └────────────────────┘
```

`server/index.js` shrinks to transport: parse message → call the matching `gameActions` function → done. It keeps owning the socket/roster bookkeeping (`join`, `welcome`, disconnect) since that genuinely is transport-specific.

---

## Components

### `shared/navGraph.js` (new, pure)

Turns the room graph + corridor geometry into the movement primitives a bot needs. Pure functions over `ROOM_LAYOUT`/`computeCorridors` output, so it unit-tests without any server or Three.js.

| Export | Purpose |
| --- | --- |
| `createNavGraph(roomLayout, corridors)` | Precomputes room adjacency + a corridor lookup keyed by room pair. Returns the object the functions below hang off (built once at server start, not per tick). |
| `nav.roomIdAt(x, z)` | Which room's footprint contains this point (`null` if in a corridor). Used for "are we in the same room" sensing. |
| `nav.findRoomPath(fromRoomId, toRoomId)` | BFS over `connections`, returns the room-id chain. |
| `nav.waypointsTo(fromPosition, toRoomId, toOffset)` | The full `[x, z]` polyline a bot should walk: current position → its room's center → each corridor's waypoints along the room path → destination room center → optional in-room offset. This is the only function `botRunner` needs for movement. |
| `nav.randomAdjacentRoom(roomId, randomFn)` | For wander behavior (BOT-05). |

### `server/gameActions.js` (new)

Every game action, extracted verbatim from `index.js`'s inline handlers, now keyed on `playerId` instead of `socket`. Each keeps its own validation (alive, correct role, correct phase) so a bot gets exactly the same rules a human does - a bot calling `doKill` with an invalid target is rejected identically.

Constructed with its dependencies (`{ getMatch, setMatch, players, broadcastToAll, sendToPlayer, onMeetingScheduled }`) rather than importing server globals, so it stays testable and has no import cycle with `index.js`.

| Export | Notes |
| --- | --- |
| `doTaskComplete(playerId, taskId)` | unchanged logic; broadcasts `tasksProgress`, `checkAndBroadcastWin(true)` |
| `doKill(playerId, targetId)` | unchanged; broadcasts `playerDied`, `checkAndBroadcastWin(false)` |
| `doCallMeeting(playerId)` | unchanged; broadcasts `meetingStarted`, arms the meeting timer |
| `doVote(playerId, targetId)` | unchanged; early-finishes the meeting when all living players have voted |
| `doVent(playerId, ventId)` | unchanged; replies `teleport` **to that player only**. For a bot there's no socket - the bot's own position is updated directly instead (see `botRunner`). |

### `server/botBrain.js` (new, pure - **never receives `match`**)

One brain per bot. Holds that bot's private memory and answers "what should I do."

```
createBotBrain(botId, randomFn) -> {
  // memory writes - fed by botRunner from observable events only
  noteNearbyPlayers(playerIds, roomId, now),
  noteWitnessedKill(killerId, victimId, roomId, now),
  noteWitnessedVent(playerId, roomId, now),
  noteDeath(victimId),            // public info: everyone sees playerDied

  // decisions - read only this bot's own memory
  decideVote(livingPlayerIds, randomFn),   // BOT-11 priority order
  shouldReportKill(now),                    // BOT-12
  clearAfterMeeting(),
}
```

`decideVote`'s priority order (spec BOT-11): witnessed killer → witnessed venter → last player seen alone with a known victim → random skip-or-accuse. Every branch reads only this bot's own log; the function's signature has no way to reach role data.

### `server/botRunner.js` (new)

The simulation loop. Owns `Map<botId, BotState>` where `BotState` is `{ position, rotationY, path, pathIndex, brain, taskHoldRemaining, killCooldown, ventCooldown }`.

- **Tick** at the same 15 Hz the clients send `state` at, so bot motion looks identical to a human's.
- **Movement**: advance along `path` at the human walk speed; on arrival, pick the next goal from role/state (next incomplete task room → task offset; else wander).
- **Sensing** (drives the brains): each tick, for each bot, find every living player (human or bot) within `SENSE_RADIUS` in the same room, and call `noteNearbyPlayers`. `doKill`/`doVent` notify `botRunner`, which fans the event out to exactly those brains whose bot was within `SENSE_RADIUS` at that moment - this is where the "limited memory" guarantee is physically enforced.
- **Human positions** come from the `state` messages the server already relays; `index.js` now also records the latest position per human so sensing can see them.
- **Frozen during meetings**: no movement or actions while `match.phase !== 'playing'`; bots instead schedule their `doVote` call after a randomized delay inside the voting window.

### Modified: `server/index.js`

- `MIN_PLAYERS_TO_START`: 3 → 1 (BOT-13, supersedes GAME-15).
- On `START`: after the human roster is known, add `TARGET_PLAYER_COUNT - players.size` bots via `botRunner.spawnBots(n)` - each gets a `randomUUID()` id and a name from a fixed pool, is inserted into `players`, and is announced with a normal `playerJoined` broadcast. Then `createMatch` runs over the *combined* id list, unchanged (BOT-02).
- Message handlers become one-liners delegating to `gameActions`.
- Records each human's latest position from their `state` message (for bot sensing).

### Unchanged

`shared/protocol.js`, `shared/skeldRooms.js`, `shared/corridorRouting.js`, `server/gameState.js`, and **every client module**. Bots reach clients purely as ordinary `playerJoined`/`state`/`playerDied` messages, so `remotePlayers`, `lobbyScreen`, `meetingUI`, and `main.js` need no changes at all (BOT-03).

---

## Data Flow: a bot witnessing a kill and voting

```
botRunner tick ──▶ sensing: bot B is within SENSE_RADIUS of A and C
                   B.brain.noteNearbyPlayers([A, C], 'electrical', t)

impostor bot A ──▶ gameActions.doKill(A, C)
                   ├─▶ gameState.recordDeath / broadcast playerDied  (public)
                   └─▶ botRunner.onKill(A, C, room)
                         └─▶ only brains within SENSE_RADIUS at that instant:
                             B.brain.noteWitnessedKill(A, C, 'electrical', t)

B.brain.shouldReportKill(t) ──▶ true after a short reaction delay
                                gameActions.doCallMeeting(B)

meeting voting phase ──▶ each bot, after a random delay:
                         gameActions.doVote(bot, bot.brain.decideVote(living))
                         └─ B votes A (witnessed killer)
                         └─ a bot with an empty log votes randomly / skips
```

---

## Error Handling Strategy

| Condition | Handling |
| --- | --- |
| Bot's path target room becomes unreachable | `findRoomPath` returns `null` → bot falls back to wandering; never throws mid-tick |
| Bot action rejected by `gameActions` validation | Silently ignored, same as a human's invalid message - the bot retries next tick |
| A tick throws | Caught per-bot so one bad bot can't kill the whole simulation loop or the server |
| Match ends / no match | Tick loop stops driving bots; state is discarded when the next match starts |

---

## Testing Strategy

Per `.specs/codebase/TESTING.md`'s matrix (pure logic → unit tests; I/O and integration → smoke test):

| Module | Test type | Rationale |
| --- | --- | --- |
| `shared/navGraph.js` | unit | Pure functions over map data - path correctness is exactly what unit tests are for |
| `server/botBrain.js` | unit | Pure decision logic; the omniscience rule is *itself* testable (a brain with an empty log must not reliably pick the impostor) |
| `server/gameActions.js` | none (covered by existing smoke tests) | Extracted verbatim; the existing `core-game-loop` smoke tests already exercise every action via sockets and must keep passing unchanged - that's the regression check |
| `server/botRunner.js` | none - smoke test | Timing/loop/broadcast integration; verified with a real WebSocket client watching a full bot match |
| `server/index.js` | none - smoke test | Transport wiring, as before |
