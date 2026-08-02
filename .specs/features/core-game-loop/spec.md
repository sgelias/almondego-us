# Core Game Loop Specification

## Problem Statement

Milestone 2 proved players can see each other move in real time, but there's no actual *game* yet — no roles, no tasks, no way to win or lose. This feature adds the rest of Among Us's core loop on top of the existing relay server and protocol: role assignment, crewmate tasks, impostor kill, emergency meetings, voting/ejection, and win/loss conditions.

**Scope-narrowing assumptions (stated per coding-principles — flag if wrong):**

- **Exactly one Impostor per match**, not a configurable count. Among Us normally scales impostor count with lobby size; v1 keeps this fixed for simplicity, matching the "moderate essential loop" scope already set for this project.
- **One uniform task type**: "hold the interact key for ~2 seconds while in range." Among Us has many distinct task minigames; building several bespoke minigames is a large lift with no art/asset budget, so v1 reuses the interact-prompt system from Milestone 1 with a hold-duration instead of an instant press.
- **Majority-vote ejection, ties eject no one** (same as the real game's default rule) — simplest deterministic tally, no tie-breaker mechanic.
- **Impostor disconnecting mid-match ends the game as a Crewmate win** — there's no impostor to reassign to, and re-running role assignment mid-match isn't in scope.
- **A match needs at least 3 connected players to start** (1 impostor + 2 crewmates, so the impostor doesn't already satisfy the parity-win condition at kickoff) — "Start Game" is blocked below that with a message.

## Goals

- [ ] A match has exactly one secret Impostor and the rest Crewmates, told privately to each player
- [ ] Crewmates can complete assigned tasks; completing them all wins the match for Crewmates
- [ ] The Impostor can kill Crewmates; anyone can call a meeting, vote, and eject a suspect
- [ ] The match correctly declares a winner (Crewmates or Impostor) and every client sees the same outcome

## Out of Scope

| Feature | Reason |
| --- | --- |
| Configurable/multiple impostors | Scope-narrowing assumption above |
| Distinct per-task minigames (wiring, asteroids, etc.) | No art/asset budget; one uniform task type instead |
| Impostor sabotage abilities (lights, O2, reactor) | Not in PROJECT.md's v1 scope; a natural Milestone 4 candidate |
| Fake tasks for the Impostor | Cosmetic parity feature, not needed to prove the core loop |
| Voice/text chat during meetings | PROJECT.md — explicitly out of scope project-wide |
| Rematch / play-again without reconnecting | Match ends, players can refresh to start a new lobby |

---

## User Stories

### P1: Roles and tasks, Crewmates can win ⭐ MVP

**User Story**: As a player, I want to be secretly assigned a role and, if I'm a Crewmate, given tasks to complete so that the match has an actual goal.

**Why P1**: Proves role sync and the task loop — the foundation everything else (kill, meetings) plugs into.

**Acceptance Criteria**:

1. WHEN the host starts the match with 3+ connected players THEN the server SHALL randomly assign exactly one player as Impostor and all others as Crewmate, and privately tell each client only their own role (never broadcast anyone else's role).
2. WHEN a Crewmate's client receives its role THEN it SHALL show a personal task list of 3 tasks drawn from a fixed pool of task locations scattered around the map, each showing its completion state.
3. WHEN a Crewmate holds the interact key within range of an assigned, incomplete task location for ~2 seconds THEN the system SHALL mark that task complete for that player and sync it to the server.
4. WHEN a player interacts with a task location that isn't assigned to them, is already complete, or they aren't a Crewmate THEN nothing SHALL happen (no prompt, no effect, no error).
5. WHEN every living Crewmate has completed all 3 of their assigned tasks THEN the server SHALL declare Crewmates the winner and broadcast the outcome to every client.

**Independent Test**: Start a match with 3 clients; whichever becomes Crewmate completes all 3 tasks; confirm both clients see a "Crewmates win" screen.

---

### P2: Impostor, meetings, voting, ejection, parity win

**User Story**: As the Impostor, I want to kill Crewmates without being caught; as a Crewmate, I want to call a meeting and vote out whoever seems suspicious.

**Why P2**: This is the actual social-deduction half of Among Us — P1 alone is just a task-completion game.

**Acceptance Criteria**:

1. WHEN the Impostor is within a short range of a living Crewmate and presses the kill key THEN the server SHALL mark that Crewmate dead and broadcast the death to all clients. **(Scope trim, discovered during T13 wiring):** v1 does not spawn a separate, reportable "body" prop at the kill location — that's a second interactable-placement and cleanup system on top of the emergency button, which already gives every living player the same fundamental capability ("call a meeting to vote"). Deferred; noted in STATE.md.
2. WHEN a living player interacts with the Cafeteria's emergency button THEN the server SHALL start a meeting: freeze every player's movement, and broadcast a discussion timer followed by a voting phase.
3. WHEN the voting phase is active THEN each living player SHALL be able to cast exactly one vote — a specific living player, or "skip" — from a roster of currently living players.
4. WHEN the voting phase ends (timer expires, or everyone living has voted) THEN the server SHALL tally votes: a strict majority of votes for one player ejects them; a tie, a majority for "skip", or no votes ejects no one. The server SHALL reveal whether the ejected player (if any) was the Impostor, and broadcast the full result to all clients.
5. WHEN the ejected player is the Impostor THEN the server SHALL declare Crewmates the winner.
6. WHEN the number of living Crewmates drops to 1 or fewer (with 1 living Impostor) THEN the server SHALL declare the Impostor the winner.
7. WHEN a player is dead (killed or ejected) THEN their own client SHALL enter a spectator state — camera still free to move, but no longer visible to living players' clients, and no longer able to vote, interact, complete tasks, or be killed.

**Independent Test**: With **4+** clients (a kill in a 3-player match immediately triggers GAME-11's parity win before any meeting can happen — see AD/lesson in STATE.md), have the Impostor kill a Crewmate, have any living player use the Cafeteria emergency button to call a meeting, run it to a vote, eject the Impostor, and confirm all clients see "Crewmates win" with the Impostor's identity revealed.

---

### P3: Vent movement (Impostor only)

**User Story**: As the Impostor, I want to duck into vents to move around unseen, so I can escape a room right after a kill.

**Why P3**: A mobility perk that reinforces the Impostor fantasy, not required for the win/loss loop to function.

**Acceptance Criteria**:

1. WHEN the Impostor interacts with a vent THEN the system SHALL instantly move them to that vent's paired vent location. Crewmates interacting with the same object SHALL see no prompt/effect at all.

**Independent Test**: As the Impostor, use a vent in one room and confirm you appear at its paired vent in another room; as a Crewmate, confirm the same vent shows no interact prompt.

---

## Edge Cases

- WHEN the Impostor disconnects mid-match THEN the server SHALL immediately declare Crewmates the winner (per the scope-narrowing assumption above).
- WHEN a Crewmate disconnects mid-match THEN the server SHALL remove them (existing NET-13 behavior) and re-check win conditions immediately afterward (their disconnect could trigger Impostor parity win).
- WHEN a new meeting or kill is attempted while a meeting or game-over state is already active THEN the server SHALL ignore it.
- WHEN "Start Game" is clicked with fewer than 3 connected players THEN the client SHALL show a message instead of starting.
- WHEN a dead player's client tries to send a task/kill/vote/meeting message THEN the server SHALL ignore it (dead players have no valid actions).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| GAME-01 | P1: Random single-Impostor role assignment, private reveal | Tasks (T4, T12) | Verified (via smoke test) |
| GAME-02 | P1: Crewmate task list (3 tasks) shown on role reveal | Tasks (T4, T8) | Implementing (needs browser playtest — HUD rendering) |
| GAME-03 | P1: Hold-to-complete task interaction, synced to server | Tasks (T9, T12) | Implementing (needs browser playtest — hold-interaction UI); server sync verified via smoke test |
| GAME-04 | P1: Invalid task interactions are inert | Tasks (T5, T9, T13) | Implementing (needs browser playtest — prompt suppression) |
| GAME-05 | P1: All-tasks-done triggers Crewmate win | Tasks (T4, T12) | Verified (via smoke test, incl. dead-crewmate regression — STATE.md L-009, L-011) |
| GAME-06 | P2: Impostor kill within range | Tasks (T4, T12) | Verified (via smoke test, incl. kill-must-not-itself-win-by-tasks regression — STATE.md L-011) |
| GAME-07 | P2: Emergency-button triggers meeting | Tasks (T6, T10, T12) | Verified (via smoke test — server logic); UI needs browser playtest |
| GAME-08 | P2: Voting phase, one vote per living player | Tasks (T10, T12) | Verified (via smoke test — server logic); UI needs browser playtest (see STATE.md L-008, pointer-lock release) |
| GAME-09 | P2: Vote tally, ejection rule, Impostor reveal | Tasks (T4, T12) | Verified (via smoke test) |
| GAME-10 | P2: Impostor ejected triggers Crewmate win | Tasks (T4, T12) | Verified (via smoke test) |
| GAME-11 | P2: Parity triggers Impostor win | Tasks (T4, T12) | Verified (via smoke test — see STATE.md L-006, L-007) |
| GAME-12 | P2: Dead player enters spectator state | Tasks (T12, T13) | Implementing (needs browser playtest); server-side alive-gating verified via smoke test |
| GAME-13 | P3: Impostor-only vent teleport | Tasks (T2, T6, T12) | Verified (via smoke test — server logic); prompt suppression needs browser playtest |
| GAME-14 | Edge: Impostor disconnect ends game (Crewmate win) | Tasks (T12) | Verified (via smoke test) |
| GAME-15 | Edge: min 3 players to start (1 impostor stays outnumbered from the start) | Tasks (T12, T13) | Verified (via smoke test — see STATE.md L-006) |

**Coverage:** 15 total, 15 mapped to tasks, 0 unmapped

---

## Success Criteria

- [ ] A 3+ player match can be played start-to-finish through either win path (all tasks done, or Impostor ejected/wins by parity) with every client agreeing on the outcome
- [ ] No client ever learns another player's role except via a meeting's ejection reveal
- [ ] A dead player can keep spectating without appearing to living players or being able to affect the match
