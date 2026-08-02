# State

**Last Updated:** 2026-08-01
**Current Work:** Project initialized — about to specify Milestone 1, Feature "3D Map & Rendering" + "First-Person Controller"

---

## Recent Decisions (Last 60 days)

### AD-001: Real 3D via Three.js instead of raycasting engine (2026-08-01)

**Decision:** Use Three.js (WebGL) for real 3D rendering instead of a classic Doom-style raycasting engine.
**Reason:** User explicitly chose "3D real com Three.js" over the raycasting options.
**Trade-off:** Heavier runtime than a raycaster; requires basic 3D math/scene graph knowledge over 2D grid math.
**Impact:** Map, collision, and rendering tasks will be built around Three.js scenes, meshes, and cameras.

### AD-002: LAN multiplayer via WebSocket, not single-player/hot-seat (2026-08-01)

**Decision:** v1 targets real multiplayer over local network (Node.js + `ws` server), not single-player-vs-bots or same-keyboard hot-seat.
**Reason:** User explicitly chose "Multiplayer via rede local (WebSocket/WebRTC)".
**Trade-off:** Significant added complexity — server-authoritative state, network sync, lobby — before core gameplay can be tested with more than one person.
**Impact:** Roadmap splits movement/rendering (Milestone 1) from networking (Milestone 2) so the first-person feel can be validated solo before multiplayer complexity is added.

### AD-003: No client build step (2026-08-01)

**Decision:** Client is vanilla JS with ES modules, no bundler (Vite/Webpack/etc.).
**Reason:** User chose "HTML/JS puro, sem build" explicitly as recommended option.
**Trade-off:** No hot-reload dev server convenience; must manage script loading order/CDN or vendored Three.js manually.
**Impact:** Three.js must be included via CDN `<script type="importmap">` or a vendored local copy, not npm+bundler.

### AD-004: Full essential game loop targeted for v1 (2026-08-01)

**Decision:** v1 scope includes the complete core loop: movement, tasks, impostor kill/vent, emergency meetings, voting, win/loss — not a reduced exploration-only slice.
**Reason:** User chose "Loop completo essencial" explicitly.
**Trade-off:** Larger overall scope; will need Design + Tasks phases (not quick mode) given the architectural surface (networking + game state machine + 3D rendering).
**Impact:** ROADMAP.md splits this into 3 milestones so each is independently shippable/testable rather than one giant feature.

---

## Active Blockers

None yet.

---

## Lessons Learned

None yet.

---

## Quick Tasks Completed

None yet.

---

## Deferred Ideas

None yet — captured in PROJECT.md "Explicitly out of scope" instead (multiple maps, cosmetics, voice chat, mobile controls, internet play).

---

### AD-005: Optimize for maintainability/extensibility, not speed of first build (2026-08-01)

**Decision:** Every design/implementation from here on should draw module boundaries along the seams later milestones will actually need (single state ownership per concern, clean wiring points), without writing unused speculative code for features not yet built.
**Reason:** User explicitly asked: "Escreva ele do jeito que facilite a manutenção e extensibilidade posterior" (write it so it's easy to maintain/extend later).
**Trade-off:** Slightly more upfront thought about module boundaries per feature; still must avoid over-engineering (no empty folders/types for unbuilt features — that would violate the "no speculative abstractions" default).
**Impact:** First-person-movement design.md's components (`map`, `player`, `ui`, `interaction`) are deliberately decoupled so Milestone 2 (networking) and Milestone 3 (game loop) can be added by wiring new modules in `main.js`, not by rewriting existing ones. Apply the same lens to every future design.md.

---

## Todos

- [ ] Specify Milestone 1 features ("3D Map & Rendering", "First-Person Controller") — next step
- [ ] Design phase likely needed before Milestone 2 (networking architecture: message protocol, authoritative state, reconciliation)

---

## Preferences

**Model Guidance Shown:** never
