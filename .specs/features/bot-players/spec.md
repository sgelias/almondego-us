# Bot Players Specification

## Problem Statement

The full game loop only works with 4+ real people connected at once (per `core-game-loop`'s min-player rules). The user wants to be able to play solo or with just one friend: the server should fill every empty lobby slot with an AI-controlled bot, so a match always has a full, playable roster regardless of how many humans actually joined.

**Scope-narrowing assumptions (stated per coding-principles - flag if wrong):**

- **Fixed total of 6 players per match.** If fewer than 6 humans have joined when the host starts, the server adds bots to reach 6. If 6 or more humans have joined, no bots are added (v1 doesn't support more than 6 total). User chose this over a host-configurable total.
- **"Elaborate" bot behavior** (user's explicit choice over "simple"): bots don't have direct access to `match.impostorId` or any other player's private role - each bot keeps its own limited memory of what it has personally witnessed (who it was near, who it saw kill, who it saw use a vent) and reasons from that alone. This is a hard rule, not a suggestion: **a bot's decision logic may only read its own sighting log, never the authoritative match state's role/kill attribution directly.** Violating this trivially wins every game for whichever side reads the "answer key."
- **Bots are simulated entirely server-side.** There's no client for a bot to run - the server owns each bot's position/state and drives it on a tick, broadcasting `state`/`playerJoined`/etc. exactly like a real client would. This reuses every existing client-side rendering/roster path (`remotePlayers`, `lobbyScreen`, `meetingUI`) with zero client changes.
- **No separate "bot difficulty" setting.** Every bot uses the same behavior described in P2/P3 - v1 doesn't have an easy/hard toggle.
- **`MIN_PLAYERS_TO_START` drops from 3 to 1.** With bots always padding the roster to 6, the parity-at-kickoff problem `core-game-loop`'s AD/L-006 fixed no longer applies (a 6-player match is never at parity when it starts) - this spec supersedes GAME-15 from `core-game-loop/spec.md`.
- **Bots don't leave mid-match.** There's no "bot disconnects" case to handle - a bot's lifecycle is exactly the length of one match.

## Goals

- [ ] Clicking "Start Game" with 1-5 humans connected fills the remaining slots with bots (up to 6 total) instead of being blocked or requiring more people
- [ ] Bots visibly move around the map, do Crewmate tasks, or kill/vent as the Impostor, using the same map and rules as a real player
- [ ] Bots vote at meetings using only what they could plausibly have witnessed themselves, not omniscient knowledge of who the Impostor is

## Out of Scope

| Feature | Reason |
| --- | --- |
| Host-configurable total player count | Scope-narrowing assumption above - fixed at 6 |
| Bot difficulty levels | Not requested; one behavior tier for v1 |
| Bots calling a meeting by finding an unwitnessed body | No "body" prop exists in v1 (core-game-loop's scope trim) - a bot can only report what it personally saw |
| Bot chat/text reasoning shown to players | Bots communicate only through the vote they cast, same channel every player uses |
| More than 6 total players | Scope-narrowing assumption above |

---

## User Stories

### P1: A match always has a full roster ⭐ MVP

**User Story**: As a player, I want to start and play a full match even if I'm alone or with just one friend, so the game doesn't require rounding up 3+ other people.

**Why P1**: Without this, nothing else in this feature has a match to run in.

**Acceptance Criteria**:

1. WHEN the host clicks "Start Game" with between 1 and 5 humans connected THEN the server SHALL add enough bots to bring the total to 6 before creating the match.
2. WHEN 6 or more humans are connected THEN the server SHALL start the match with no bots added.
3. WHEN bots are added THEN every client SHALL see them appear in the roster/HUD exactly like a human player (name, role reveal for the local player only, capsule + name label once the match starts) - no client code should need to know a given id is a bot.
4. WHEN a match is running THEN bots SHALL be assigned roles and tasks through the exact same `gameState.createMatch`/`getRole`/`getAssignedTasks` calls used for humans - no separate bot-only code path in role/task assignment.

**Independent Test**: Join with 1 client, start the match, confirm 5 bots appear in the roster and the match proceeds (roles assigned, HUD shows tasks/role) exactly as a 6-human match would.

---

### P2: Bots act on their role

**User Story**: As a player, I want Crewmate bots to wander around doing tasks and the Impostor bot (if it's a bot) to actually try to kill and vent, so the match plays out instead of bots standing still.

**Why P2**: A bot that doesn't act isn't a substitute for a missing player - the match would stall.

**Acceptance Criteria**:

1. WHEN a Crewmate bot has an incomplete assigned task THEN it SHALL path to that task's room, stand at the task's location for the same hold duration a human uses, and complete it (broadcasting `tasksProgress` and re-checking the win condition exactly like a human's `taskComplete` message would).
2. WHEN a Crewmate bot has completed all its tasks THEN it SHALL wander between rooms (picking a random connected room via the map's corridor graph) rather than standing still.
3. WHEN the Impostor bot is alone in a room with exactly one other living player (no other living player within sensing range of either of them) THEN it SHALL kill that player, subject to a cooldown so it doesn't kill on literally its first opportunity every match.
4. WHEN the Impostor bot is not alone with a viable target THEN it SHALL NOT attempt a kill (per the user's "elaborate" choice: it avoids killing in front of witnesses).
5. WHEN the Impostor bot is wandering without a kill opportunity THEN it SHALL occasionally (not every tick) use a vent to relocate, the same way a human Impostor would.
6. WHEN any bot moves THEN the server SHALL broadcast its position via the existing `state` message on the same cadence as human clients, so `remotePlayers.upsert` renders it identically.

**Independent Test**: Start a match where the sole human is a Crewmate; confirm at least one bot (Crewmate or Impostor) visibly moves, and if a bot is the Impostor, that a kill eventually happens when it gets a lone target.

---

### P3: Bots vote from their own limited memory, not omniscience

**User Story**: As a player, I want bots at a meeting to vote based on what they could plausibly have seen, not to instantly out the Impostor every time, so meetings stay meaningful.

**Why P3**: This is the crux of "elaborate" bot behavior the user asked for - without it, bots are either uselessly random or unfairly all-knowing.

**Acceptance Criteria**:

1. WHEN a bot is within sensing range of a kill at the moment it happens THEN it SHALL record that specific kill (killer + victim + room) in its own private sighting log.
2. WHEN a bot is within sensing range of any player using a vent THEN it SHALL record that player + room in its own private sighting log (venting is a strong tell, since only the Impostor can do it).
3. WHEN a bot shares a room with another living player THEN it SHALL update a private "last seen together" record for that player (room + approximate time).
4. WHEN a meeting reaches its voting phase THEN each bot SHALL cast exactly one vote, decided in this order from its own log only: (a) a player it directly witnessed kill, (b) a player it directly witnessed vent, (c) whoever it last saw alone with the reported victim shortly before the death, (d) if none of the above, a random choice between skipping and voting a random living player.
5. WHEN a bot has witnessed a kill THEN it SHALL call a meeting shortly afterward (a short reaction delay, not instantly).
6. WHEN a bot learns of a death it did *not* witness THEN it MAY still call a meeting, but only after a noticeably longer, per-bot randomized delay. **(Added during T6 verification):** deaths are already public - the server broadcasts `playerDied` to every client - so this is not privileged information, and it stands in for "you notice someone is missing." Without it, a solo human's match could stall indefinitely: bots only ever met if the impostor was careless enough to kill in front of one, which by BOT-06's own design it avoids.

**Independent Test**: Force a bot to witness a kill (position it near a scripted kill in a smoke test); confirm its vote at the following meeting targets the killer, while a bot with an empty sighting log votes randomly/skips instead of always finding the Impostor.

---

## Edge Cases

- WHEN the Impostor role is assigned to a bot THEN nothing about role assignment, win conditions, or the `gameOver` message SHALL differ from a human Impostor - the win/loss rules from `core-game-loop` are unchanged.
- WHEN a bot is the target of the local human's `getPromptText`/kill/vote logic THEN it SHALL behave exactly like a human target (killable, votable, named) - no client-side special-casing.
- WHEN all 5 non-host slots are bots (a solo human match) THEN the human SHALL still be able to complete the full loop (win by tasks, be killed, vote, etc.) without any bot-specific human-side UI.
- WHEN a human's client disconnects mid-match THEN existing `core-game-loop` disconnect handling applies unchanged - bots are not aware of and do not react specially to a human leaving.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| BOT-01 | P1: Fill lobby to 6 total with bots on start | Tasks (T5) | Verified (smoke test: solo human → 6-player roster) |
| BOT-02 | P1: Bots use existing role/task assignment, no separate code path | Tasks (T2, T5) | Verified (smoke test; `gameActions` is the single implementation) |
| BOT-03 | P1: Bots render/broadcast exactly like human players | Tasks (T4, T5) | Verified (smoke test: bots arrive as `playerJoined` + `state`); browser playtest pending |
| BOT-04 | P2: Crewmate bot paths to and completes assigned tasks | Tasks (T1, T4) | Verified (smoke test: reached 12/12 and 9/9 task wins) |
| BOT-05 | P2: Crewmate bot wanders once tasks are done | Tasks (T1, T4) | Verified (smoke test: all 5 bots kept moving after finishing) |
| BOT-06 | P2: Impostor bot kills only when alone with a target, on a cooldown | Tasks (T4) | Verified (smoke test: bot impostor killed 1-2 per match, incl. the human) |
| BOT-07 | P2: Impostor bot uses vents occasionally while wandering | Tasks (T4) | Implementing (code complete; not observed in a smoke run - low per-tick chance) |
| BOT-08 | P3: Bot sighting log records witnessed kills | Tasks (T3, T4) | Verified (unit) |
| BOT-09 | P3: Bot sighting log records witnessed vent use | Tasks (T3, T4) | Verified (unit) |
| BOT-10 | P3: Bot sighting log records "last seen with" per player | Tasks (T3, T4) | Verified (unit) |
| BOT-11 | P3: Bot vote decision uses only its own sighting log, in the specified priority order | Tasks (T3) | Verified (unit, incl. the blind-bot statistical check) |
| BOT-12 | P3: Bot calls a meeting after a witnessed kill, or later after any known death | Tasks (T3, T4) | Verified (unit + smoke test: a meeting occurred in every completed match) |
| BOT-13 | Edge: `MIN_PLAYERS_TO_START` becomes 1 (supersedes core-game-loop's GAME-15) | Tasks (T5) | Verified (smoke test) |

**Coverage:** 13 total, 13 mapped to tasks, 0 unmapped

---

## Success Criteria

- [ ] A single human can start, play, and finish a full match (any win path) with 5 bots filling the rest of the roster
- [ ] Over several matches, bots are not always correct at voting (their accuracy depends on witnessed evidence, not omniscience) - confirmed via a scripted "no witness" scenario producing a non-Impostor-targeted vote at least sometimes
- [ ] No client-side code branches on "is this player a bot" - bots are indistinguishable from humans to the rendering/interaction layer
