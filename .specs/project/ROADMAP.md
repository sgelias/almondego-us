# Roadmap

**Current Milestone:** Core Game Loop
**Status:** All 3 milestones COMPLETE (2026-08-02) — the full game (movement, multiplayer, roles/tasks/kill/vent/meetings/voting/win-loss) was played start-to-finish across 4 browser windows and confirmed working by the user. v1 scope (per PROJECT.md) is done.

---

## Milestone 1: First-Person Movement Core

**Goal:** A single player can walk around a 3D spaceship map in first person, with mouselook and wall/object collision — the "Doom feel" is proven before any networking or game rules are added.
**Target:** Playable local build, no multiplayer yet.
**Status:** ✅ COMPLETE (2026-08-01) — see `.specs/features/first-person-movement/`

### Features

**3D Map & Rendering** - COMPLETE

- Three.js scene with a spaceship-like map (rooms + corridors)
- Basic lighting, primitive/low-poly geometry (no custom art assets needed)

**First-Person Controller** - COMPLETE

- WASD movement + mouselook (pointer lock)
- Collision detection against walls/obstacles
- Interact key for future task/vent/report interactions

---

## Milestone 2: Local Multiplayer Foundation

**Goal:** Multiple browsers on the same LAN connect to a host's Node.js server and see each other moving in the shared map in real time.
**Status:** ✅ COMPLETE (2026-08-02) — see `.specs/features/local-multiplayer/`. Verified end-to-end via real WebSocket smoke tests and a 4-browser-window user playtest.

### Features

**WebSocket Server & Lobby** - COMPLETE

- Node.js + `ws` server, host starts it and shares LAN IP
- Player join/name entry, lobby list, "start game" trigger

**Networked Player Sync** - COMPLETE

- Server-authoritative position broadcast
- Client-side interpolation for other players' movement

---

## Milestone 3: Core Game Loop

**Goal:** A full Among Us match is playable start to finish: roles, tasks, impostor abilities, meetings/voting, and win/loss conditions.
**Status:** ✅ COMPLETE (2026-08-02) — see `.specs/features/core-game-loop/`. Verified end-to-end via real multi-client smoke tests and a 4-browser-window user playtest covering all three win paths (task completion, Impostor ejection, parity) plus vent movement.

### Features

**Role Assignment & Tasks** - COMPLETE
**Impostor Abilities (Kill & Vent)** - COMPLETE
**Meetings & Voting** - COMPLETE
**Win/Loss Conditions** - COMPLETE

---

## Future Considerations

- Additional maps
- Cosmetics/skins
- Spectator mode for dead players
- Proximity voice chat
- Mobile/touch controls
