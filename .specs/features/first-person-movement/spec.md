# First-Person Movement Specification

## Problem Statement

The whole premise of the project is Among Us reimagined as a first-person, Doom-like experience. Before any networking or game rules can be built, we need to prove the core feel: walking through a 3D spaceship map with mouselook and solid collision, rendered with Three.js.

## Goals

- [ ] Player can move and look around a 3D map with no clipping through geometry
- [ ] Movement feels like a first-person shooter (responsive, slightly stylized), not a slow walking simulator

## Out of Scope

| Feature | Reason |
| --- | --- |
| Networking/multiplayer sync | Belongs to Milestone 2 (Local Multiplayer Foundation) |
| Tasks, minigames | Belongs to Milestone 3 (Core Game Loop) |
| Impostor kill/vent, meetings, voting | Belongs to Milestone 3 (Core Game Loop) |
| Custom 3D art/textures | v1 uses primitive/low-poly geometry per PROJECT.md scope |

---

## User Stories

### P1: Walk the ship in first person ⭐ MVP

**User Story**: As a player, I want to move through the ship map using WASD and look around with the mouse, so that I can explore the environment like in a first-person shooter.

**Why P1**: This is the vertical slice that proves the "Doom-like Among Us" concept before anything else is built.

**Acceptance Criteria**:

1. WHEN the player presses W/A/S/D THEN the system SHALL move the camera forward/back/left/right relative to the current view direction, at a constant walking speed.
2. WHEN the player moves the mouse with pointer lock active THEN the system SHALL rotate the camera's yaw and pitch accordingly, with pitch clamped to prevent the camera flipping over.
3. WHEN the player attempts to walk into a wall or solid object THEN the system SHALL block movement into that geometry, sliding along surfaces when approaching at an angle rather than stopping dead.
4. WHEN the page loads THEN the system SHALL render a 3D spaceship-like map (multiple rooms connected by corridors) using Three.js with basic lighting.

**Independent Test**: Serve the project with a static file server, click the canvas to lock the pointer, and walk through at least two rooms and a connecting corridor without clipping through any wall.

---

### P2: Doom-like movement feel

**User Story**: As a player, I want movement to feel snappy and slightly stylized (sprint, head-bob) so it feels like a first-person shooter rather than a slow walking simulator.

**Why P2**: Not required to prove the concept works, but core to the "Doom-like" identity of the project.

**Acceptance Criteria**:

1. WHEN the player holds the sprint key THEN the system SHALL increase movement speed by a defined multiplier over the base walking speed.
2. WHEN the player is moving THEN the system SHALL apply a subtle camera head-bob effect that stops when the player stops moving.

**Independent Test**: Hold the sprint key and confirm faster traversal and visible head-bob; release and confirm it stops.

---

### P3: Interact affordance placeholder

**User Story**: As a player, I want a crosshair and an interact prompt so I know when I'm near something interactable, in preparation for tasks/vents/bodies in later milestones.

**Why P3**: Not needed to validate movement, but establishes the interaction pattern later features depend on.

**Acceptance Criteria**:

1. WHEN the player looks at a placeholder interactable object within a defined range THEN the system SHALL show a highlight or prompt, even though no action fires yet in this feature.

**Independent Test**: Place one placeholder interactable in the map; verify the prompt appears only within range and while looking at it.

---

## Edge Cases

- WHEN pointer lock is lost (Esc pressed or window loses focus) THEN the system SHALL pause mouselook and show a "click to resume" overlay.
- WHEN the player moves diagonally (e.g. W+D held together) THEN the system SHALL normalize speed so diagonal movement is not faster than cardinal movement.
- WHEN the browser window is resized THEN the system SHALL update the renderer's camera aspect ratio and canvas size accordingly.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| FPM-01 | P1: Map rendering (Three.js, rooms + corridors, lighting) | Tasks: T1, T4 | Implementing |
| FPM-02 | P1: WASD movement relative to view direction | Tasks: T6 | Implementing |
| FPM-03 | P1: Mouselook via pointer lock, pitch clamped | Tasks: T3, T6 | Implementing |
| FPM-04 | P1: Wall/object collision with sliding | Tasks: T5, T6 | Implementing |
| FPM-05 | P2: Sprint speed multiplier | Tasks: T6 | Implementing |
| FPM-06 | P2: Head-bob effect | Tasks: T6 | Implementing |
| FPM-07 | P3: Interact prompt/crosshair on look-at | Tasks: T4, T8 | Implementing |
| FPM-08 | Edge: pointer lock loss overlay | Tasks: T7 | Implementing |
| FPM-09 | Edge: diagonal movement normalization | Tasks: T3, T6 | Implementing |
| FPM-10 | Edge: window resize handling | Tasks: T9 | Implementing |

**Coverage:** 10 total, 10 mapped to tasks, 0 unmapped

**Note:** "Implementing" means the code is written and the unit-test/build gate is green (see TESTING.md). It moves to "Verified" only after the manual playtest in T9 (rendering/collision/feel can't be automated per this project's testing convention) — see STATE.md for current status.

---

## Success Criteria

- [ ] Player can walk through the full map (all rooms + corridors) with no visual clipping through walls
- [ ] Pointer lock mouselook works smoothly with no camera flip at extreme pitch
- [ ] Sprint and head-bob are visibly distinct from base walking
