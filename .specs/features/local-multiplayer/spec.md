# Local Multiplayer Foundation Specification

## Problem Statement

Among Us is fundamentally a social game — Milestone 1 proved the first-person "Doom feel" solo, but nobody can play *with* anyone yet. This feature lets a host run a small Node.js server on their LAN, and lets other players on the same network join from a browser, enter a lobby, and see each other move around the shared Skeld map in real time before any task/impostor rules exist.

**Trust model (assumption, stated per coding-principles — flag if wrong):** Per PROJECT.md, this is LAN-only among trusted players with no anti-cheat requirement. So the server acts as a **relay**, not a physics simulator: each client keeps computing its own movement/collision locally (reusing Milestone 1's `playerController`) and just broadcasts its resulting state; the server rebroadcasts it to everyone else without re-validating it. This is explicitly not the same as "authoritative" in the sense of a competitive-multiplayer game preventing speed-hacking — that hardening is out of scope (PROJECT.md).

## Goals

- [ ] A host can start a server from a terminal and share their LAN IP for others to join
- [ ] 2+ players in the same map see each other's avatars move smoothly in real time
- [ ] The host can start the match once players have joined, moving everyone from the lobby into the 3D scene together

## Out of Scope

| Feature | Reason |
| --- | --- |
| Internet play / matchmaking | PROJECT.md — LAN only |
| Server-side physics re-validation of client-reported positions | PROJECT.md — no anti-cheat requirement; LAN-trusted relay model (see Problem Statement) |
| Voice/text chat | PROJECT.md — explicitly out of scope |
| Roles, tasks, kill/vent, meetings/voting | Milestone 3 — this feature only proves players can see each other move |
| Reconnect-with-state-recovery after a dropped connection | v1 just removes the disconnected player's avatar; rejoining is a fresh join |
| A hard player-count cap | Not requested; untested beyond ~6 players but nothing artificially blocks more |

---

## User Stories

### P1: See other players move in real time ⭐ MVP

**User Story**: As a player, I want to see other connected players' avatars move around the map as they play, so that the game is actually shared instead of solo.

**Why P1**: This is the entire point of the milestone — everything else (lobby, names) exists to get players into this state.

**Acceptance Criteria**:

1. WHEN the host runs the server start command THEN the system SHALL listen for WebSocket connections on a port and log the LAN IP:port to the terminal for players to connect to.
2. WHEN a client connects and its player joins the match THEN the server SHALL assign it a unique player id and notify all other connected clients of the new player.
3. WHEN a connected player's local position/rotation changes THEN the client SHALL periodically send its state to the server, and the server SHALL relay it to every other connected client.
4. WHEN a client receives another player's state update THEN it SHALL render that player as a placeholder avatar (capsule + floating name label) at the correct position/orientation in its own 3D scene, interpolating between updates so movement reads as smooth rather than teleporting.
5. WHEN a player disconnects (tab closed, network drop) THEN the server SHALL notify remaining clients and that player's avatar SHALL be removed from everyone else's scene.

**Independent Test**: Run the server, open the client in two browser windows/tabs on the same machine (or two LAN machines), join both, and confirm each window shows the other player's avatar moving as the other window's WASD/mouse is used.

---

### P2: Lobby with names and host-triggered start

**User Story**: As a player, I want to enter my name and see who else has joined before the match starts, so I know who I'm playing with.

**Why P2**: Needed for a coherent multi-person session, but the raw position-sync in P1 is the harder/riskier part to prove first.

**Acceptance Criteria**:

1. WHEN a client loads the page THEN the system SHALL show a join screen: the host can click "Host & Join", a non-host enters the host's LAN IP:port plus a display name.
2. WHEN a client is in the lobby THEN the system SHALL show a live-updating list of connected player names.
3. WHEN two players choose the same display name THEN the system SHALL append a distinguishing suffix (e.g. a number) rather than blocking the join.
4. WHEN the host clicks "Start Game" (visible only to the host) THEN the server SHALL broadcast a start signal and every client SHALL transition from the lobby screen into the 3D scene at the same time.

**Independent Test**: Join as host and as a second player with a duplicate name in the lobby; confirm the name gets a suffix, the list updates live, and clicking "Start Game" moves both into the 3D scene together.

---

### P3: Clear failure feedback

**User Story**: As a player, I want to know immediately if I can't reach the host, instead of the page silently doing nothing.

**Why P3**: Quality-of-life for a LAN game where typos in an IP address are the most likely failure mode.

**Acceptance Criteria**:

1. WHEN a client attempts to connect to an unreachable or incorrect host IP:port THEN the system SHALL show a clear "couldn't connect" message on the join screen within a few seconds, not hang indefinitely.

**Independent Test**: Enter a bogus IP:port on the join screen and confirm a visible error appears.

---

## Edge Cases

- WHEN the host also plays (hosts and joins in the same browser tab) THEN their client SHALL behave identically to any other client except for owning the "Start Game" button.
- WHEN a state update arrives out of order (later send, earlier arrival due to network jitter) THEN the receiving client SHALL discard it if it's older than the last-applied update for that player, rather than making the avatar jitter backward.
- WHEN a client's WebSocket connection drops mid-match (not just in the lobby) THEN other clients SHALL remove that player's avatar the same way as a lobby disconnect — no separate "reconnecting" state for v1.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| NET-01 | P1: Server listens, logs LAN IP:port | Design | Pending |
| NET-02 | P1: Player join assigns id, notifies others | Design | Pending |
| NET-03 | P1: Client state broadcast/relay | Design | Pending |
| NET-04 | P1: Remote player avatar render + interpolation | Design | Pending |
| NET-05 | P1: Disconnect removes avatar for others | Design | Pending |
| NET-06 | P2: Join screen (host vs. join-by-IP + name) | Design | Pending |
| NET-07 | P2: Live lobby player list | Design | Pending |
| NET-08 | P2: Duplicate name suffixing | Design | Pending |
| NET-09 | P2: Host-triggered synchronized match start | Design | Pending |
| NET-10 | P3: Connection-failure feedback | Design | Pending |
| NET-11 | Edge: host-as-player parity | Design | Pending |
| NET-12 | Edge: stale/out-of-order update discard | Design | Pending |
| NET-13 | Edge: mid-match disconnect handling | Design | Pending |

**Coverage:** 13 total, 0 mapped to tasks, 13 unmapped ⚠️

---

## Success Criteria

- [ ] Two+ players on the same LAN can join a lobby, see each other's names, and both transition into the 3D scene when the host starts
- [ ] Each player sees every other player's avatar move smoothly and stay reasonably in sync (no teleporting, no long-lived desync)
- [ ] A disconnect (closed tab) cleanly removes that player's avatar for everyone else without crashing the server or other clients
