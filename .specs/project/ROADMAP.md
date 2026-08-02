# Roadmap

**Current Milestone:** First-Person Movement Core
**Status:** Planning

---

## Milestone 1: First-Person Movement Core

**Goal:** A single player can walk around a 3D spaceship map in first person, with mouselook and wall/object collision — the "Doom feel" is proven before any networking or game rules are added.
**Target:** Playable local build, no multiplayer yet.

### Features

**3D Map & Rendering** - PLANNED

- Three.js scene with a spaceship-like map (rooms + corridors)
- Basic lighting, primitive/low-poly geometry (no custom art assets needed)

**First-Person Controller** - PLANNED

- WASD movement + mouselook (pointer lock)
- Collision detection against walls/obstacles
- Interact key for future task/vent/report interactions

---

## Milestone 2: Local Multiplayer Foundation

**Goal:** Multiple browsers on the same LAN connect to a host's Node.js server and see each other moving in the shared map in real time.

### Features

**WebSocket Server & Lobby** - PLANNED

- Node.js + `ws` server, host starts it and shares LAN IP
- Player join/name entry, lobby list, "start game" trigger

**Networked Player Sync** - PLANNED

- Server-authoritative position broadcast
- Client-side interpolation for other players' movement

---

## Milestone 3: Core Game Loop

**Goal:** A full Among Us match is playable start to finish: roles, tasks, impostor abilities, meetings/voting, and win/loss conditions.

### Features

**Role Assignment & Tasks** - PLANNED
**Impostor Abilities (Kill & Vent)** - PLANNED
**Meetings & Voting** - PLANNED
**Win/Loss Conditions** - PLANNED

---

## Future Considerations

- Additional maps
- Cosmetics/skins
- Spectator mode for dead players
- Proximity voice chat
- Mobile/touch controls
