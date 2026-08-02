# Among Us: First Person

**Vision:** A first-person recreation of Among Us's social deduction gameplay, rendered in real 3D (Doom-like movement and tension) instead of the original's top-down view, playable by a group over a local network.
**For:** The developer and friends/family on the same local network who want to play a home-brew, browser-based social deduction game.
**Solves:** There's no first-person, locally-hostable version of the Among Us core loop — this recreates it as a learning/fun project, fully under the player's control (no external servers, accounts, or internet dependency).

## Goals

- Ship a playable full match: 4+ players join over local network, roles assigned, crewmates complete tasks or impostor(s) reduce crew to parity — game reaches a clear win/loss screen with no crashes.
- Deliver a genuine first-person "Doom-like" feel: WASD + mouselook movement, real 3D corridors/rooms, tension from limited visibility.

## Tech Stack

**Core:**

- Client: Vanilla JavaScript (ES modules), no bundler/build step — open directly via a static file server
- Rendering: Three.js (3D, real WebGL geometry/lighting — loaded via script tag/CDN or vendored copy)
- Server: Node.js + `ws` (WebSocket) — authoritative game/lobby server for local network multiplayer
- Database: None — game state is in-memory and ephemeral per match

**Key dependencies:** three.js, ws

## Scope

**v1 includes:**

- First-person movement & collision in a single 3D spaceship-like map
- Local-network multiplayer lobby (host starts a server, players join via LAN IP)
- Role assignment (Crewmate / Impostor)
- A handful of simple task minigames for crewmates
- Impostor kill (proximity) and vent traversal between rooms
- Emergency meetings (button + report body), discussion window, voting, ejection
- Win conditions: crewmates finish all tasks or eject all impostors; impostor(s) win by reaching player parity

**Explicitly out of scope:**

- Internet/matchmaking play — LAN only
- In-game voice/text chat (assumes players are co-located or using an external call)
- Cosmetics, skins, or player customization
- Multiple maps — one map for v1
- Anti-cheat hardening beyond basic server authority over game state
- Mobile/touch controls — keyboard + mouse only

## Constraints

- Timeline: none specified
- Technical: client must run with no build tooling; Node.js required only to run the multiplayer server
- Resources: solo developer, built with Claude Code
