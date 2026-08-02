# First-Person Movement Context

**Gathered:** 2026-08-01
**Spec:** `.specs/features/first-person-movement/spec.md`
**Status:** Ready for design

---

## Feature Boundary

First-person movement and collision through a single 3D spaceship map rendered with Three.js — WASD + mouselook, sprint, head-bob, and an interact-prompt placeholder. No networking, tasks, or impostor mechanics (those are later milestones).

---

## Implementation Decisions

### Visual style / mood

- Agent's discretion (see below) — no fixed palette or lighting mood mandated by the user.

### Map layout

- Recreate The Skeld's classic layout (Cafeteria, Weapons, Navigation, O2, Shields, Communications, Storage, Electrical, Lower/Upper Engine, Security, Reactor, Medbay, Admin) as a 3D floor plan connected by corridors — matching room adjacency/connections from the original map, not necessarily 1:1 scale or decoration.

### Movement feel

- Moderate, standard-FPS pacing: subtle head-bob, comfortable default FOV, no exaggerated arcade speed — should feel like a typical modern first-person game, not classic-Doom frenetic.

### Agent's Discretion

- Exact color palette and lighting mood (bright vs. dark) — user explicitly deferred this.
- Exact numeric tuning: walking speed, sprint multiplier, FOV degrees, head-bob amplitude/frequency, mouse sensitivity — user said pick reasonable FPS-standard defaults, will adjust by feel later.
- Primitive/low-poly geometry choices for representing Skeld rooms (since custom art assets are out of scope for v1).

---

## Specific References

- "The Skeld" (Among Us's original ship map) is the explicit layout reference — room names and connections should be recognizable to anyone who has played Among Us.

---

## Deferred Ideas

None — discussion stayed within feature scope. Task minigames, impostor mechanics, and networking remain correctly deferred to Milestone 2/3 per PROJECT.md.
