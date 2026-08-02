# Roadmap

**Current Milestone:** Core Game Loop
**Status:** Code complete across all 3 milestones; awaiting a final human 4+ browser-window playtest of the full game (see STATE.md Todos)

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
**Status:** Code complete (2026-08-01) — see `.specs/features/local-multiplayer/`. Protocol/server/client layer verified end-to-end via real WebSocket smoke tests; DOM/rendering layer (lobby UI, remote avatars) not yet exercised in an actual browser.

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
**Status:** Code complete (2026-08-01) — see `.specs/features/core-game-loop/`. Server-side game rules verified end-to-end via real multi-client smoke tests (including a 4-player run through the full kill→meeting→vote→eject→win path); DOM/rendering layer not yet exercised in an actual browser.

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
