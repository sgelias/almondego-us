import * as THREE from 'three'

// Per-room set dressing. Everything built here is decor: it goes into the
// map's decor group and never into the collision group, so no prop can ever
// affect the world Octree (see STATE.md AD-007 / L-013). The trade-off is
// that props don't block movement - a player can walk through a table. That
// is deliberate for now: collidable props would each need overlap-checking
// against their neighbours, and the octree is the one part of this codebase
// that has already failed catastrophically from overlapping geometry.
//
// Which props a room gets is driven by its `theme` field rather than by its
// id, so this file stays map-agnostic - the same builder would dress a
// second arena from its own data with no changes here.

const METAL = new THREE.MeshStandardMaterial({ color: 0x6a7686, roughness: 0.55, metalness: 0.45 })
const DARK_METAL = new THREE.MeshStandardMaterial({ color: 0x39414d, roughness: 0.6, metalness: 0.5 })
const RUBBER = new THREE.MeshStandardMaterial({ color: 0x2c313a, roughness: 0.95 })
const CRATE = new THREE.MeshStandardMaterial({ color: 0x8a6b3f, roughness: 0.85 })
const WHITE_PANEL = new THREE.MeshStandardMaterial({ color: 0xd7dee8, roughness: 0.5 })
const GLASS = new THREE.MeshStandardMaterial({
  color: 0x8fd8ff,
  roughness: 0.1,
  metalness: 0.2,
  transparent: true,
  opacity: 0.45,
})
const SCREEN_BLUE = new THREE.MeshStandardMaterial({ color: 0x2aa6ff, emissive: 0x1667b5, emissiveIntensity: 1.2 })
const SCREEN_GREEN = new THREE.MeshStandardMaterial({ color: 0x36e07a, emissive: 0x18a04c, emissiveIntensity: 1.2 })
const SCREEN_AMBER = new THREE.MeshStandardMaterial({ color: 0xffb545, emissive: 0xd07d10, emissiveIntensity: 1.2 })
const HAZARD = new THREE.MeshStandardMaterial({ color: 0xf0c419, roughness: 0.7 })
const REACTOR_CORE = new THREE.MeshStandardMaterial({ color: 0x66ffd9, emissive: 0x27d7a8, emissiveIntensity: 1.6 })
const FOLIAGE = new THREE.MeshStandardMaterial({ color: 0x3f8f45, roughness: 0.9 })
const PIPE = new THREE.MeshStandardMaterial({ color: 0x8d949e, roughness: 0.45, metalness: 0.6 })

function box(group, material, w, h, d, x, y, z, rotationY = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
  mesh.position.set(x, y, z)
  mesh.rotation.y = rotationY
  group.add(mesh)
  return mesh
}

function cylinder(group, material, rTop, rBottom, h, x, y, z, segments = 14) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments), material)
  mesh.position.set(x, y, z)
  group.add(mesh)
  return mesh
}

// A waist-high bank of angled screens, the generic "control station" used by
// several rooms.
function consoleBank(group, cx, cz, width, facing, screenMaterial) {
  const rot = facing
  const base = box(group, DARK_METAL, width, 0.95, 0.6, cx, 0.475, cz, rot)
  const screen = new THREE.Mesh(new THREE.BoxGeometry(width * 0.88, 0.55, 0.08), screenMaterial)
  screen.position.set(cx, 1.15, cz)
  screen.rotation.y = rot
  screen.rotateX(-0.4)
  group.add(screen)
  return base
}

function ceilingPipes(group, cx, cz, width, depth, height) {
  for (const offset of [-0.28, 0, 0.28]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, width * 0.9, 10), PIPE)
    pipe.rotation.z = Math.PI / 2
    pipe.position.set(cx, height - 0.45, cz + offset * depth)
    group.add(pipe)
  }
}

function hazardStripes(group, cx, cz, width) {
  for (let i = -1; i <= 1; i += 1) {
    box(group, HAZARD, width * 0.22, 0.02, 0.5, cx + i * width * 0.3, 0.21, cz)
  }
}

const THEMES = {
  cafeteria(group, cx, cz, w, d, h) {
    // Round tables with stools, the room's signature look.
    for (const [ox, oz] of [[-0.26, 0.22], [0.26, 0.22], [-0.26, -0.26], [0.26, -0.26]]) {
      const tx = cx + ox * w
      const tz = cz + oz * d
      cylinder(group, METAL, 0.12, 0.12, 0.75, tx, 0.375, tz, 10)
      cylinder(group, WHITE_PANEL, 1.05, 1.05, 0.12, tx, 0.8, tz, 20)
      for (let i = 0; i < 4; i += 1) {
        const angle = (i / 4) * Math.PI * 2
        cylinder(group, RUBBER, 0.26, 0.26, 0.45, tx + Math.cos(angle) * 1.6, 0.225, tz + Math.sin(angle) * 1.6, 12)
      }
    }
    ceilingPipes(group, cx, cz, w, d, h)
  },

  weapons(group, cx, cz, w, d) {
    // A gunner's seat facing a big targeting screen.
    consoleBank(group, cx, cz - d * 0.3, 3, 0, SCREEN_AMBER)
    cylinder(group, RUBBER, 0.45, 0.5, 0.5, cx, 0.25, cz, 14)
    box(group, DARK_METAL, 0.9, 0.9, 0.25, cx, 0.85, cz + 0.4)
    for (const side of [-1, 1]) {
      cylinder(group, PIPE, 0.16, 0.16, 2.2, cx + side * w * 0.32, 1.1, cz + d * 0.3, 10)
    }
  },

  controls(group, cx, cz, w, d) {
    consoleBank(group, cx, cz - d * 0.28, w * 0.55, 0, SCREEN_BLUE)
    consoleBank(group, cx - w * 0.3, cz + d * 0.1, d * 0.4, Math.PI / 2, SCREEN_GREEN)
    cylinder(group, RUBBER, 0.42, 0.48, 0.5, cx, 0.25, cz + 0.3, 14)
  },

  greenhouse(group, cx, cz, w, d, h) {
    // O2: glass growth pods under the ceiling.
    for (const [ox, oz] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) {
      const px = cx + ox * w
      const pz = cz + oz * d
      cylinder(group, DARK_METAL, 0.5, 0.55, 0.25, px, 0.125, pz, 14)
      cylinder(group, FOLIAGE, 0.34, 0.2, 0.7, px, 0.6, pz, 10)
      const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.7, 16, 1, true), GLASS)
      pod.position.set(px, 1.1, pz)
      group.add(pod)
    }
    ceilingPipes(group, cx, cz, w, d, h)
  },

  servers(group, cx, cz, w, d) {
    // Communications: racks with blinking indicator strips.
    for (let i = -1; i <= 1; i += 1) {
      const rx = cx + i * w * 0.28
      box(group, DARK_METAL, 1.0, 2.1, 0.7, rx, 1.05, cz - d * 0.28)
      for (let row = 0; row < 4; row += 1) {
        box(group, row % 2 ? SCREEN_GREEN : SCREEN_AMBER, 0.75, 0.07, 0.04, rx, 0.5 + row * 0.42, cz - d * 0.28 - 0.37)
      }
    }
    consoleBank(group, cx, cz + d * 0.28, w * 0.5, Math.PI, SCREEN_GREEN)
  },

  storage(group, cx, cz, w, d) {
    // Crates and barrels, stacked a little unevenly.
    const spots = [
      [-0.3, -0.3, 1], [-0.3, 0.05, 2], [0.3, -0.28, 2],
      [0.32, 0.3, 1], [0.02, 0.34, 1], [-0.34, 0.34, 1],
    ]
    for (const [ox, oz, stack] of spots) {
      for (let s = 0; s < stack; s += 1) {
        box(group, CRATE, 1.1, 1.0, 1.1, cx + ox * w, 0.5 + s * 1.0, cz + oz * d, s * 0.2)
      }
    }
    for (const ox of [-0.1, 0.12]) {
      cylinder(group, HAZARD, 0.42, 0.42, 1.1, cx + ox * w, 0.55, cz - d * 0.05, 14)
    }
    hazardStripes(group, cx, cz + d * 0.42, w)
  },

  electrical(group, cx, cz, w, d, h) {
    // Wall panels with exposed wiring, plus a breaker box.
    for (let i = -1; i <= 1; i += 1) {
      const px = cx + i * w * 0.26
      box(group, DARK_METAL, 1.1, 1.5, 0.28, px, 1.3, cz - d * 0.45)
      box(group, i === 0 ? SCREEN_AMBER : SCREEN_GREEN, 0.8, 0.35, 0.05, px, 1.6, cz - d * 0.45 + 0.17)
      for (let wire = 0; wire < 3; wire += 1) {
        cylinder(group, RUBBER, 0.045, 0.045, 0.7, px - 0.3 + wire * 0.3, 0.75, cz - d * 0.45 + 0.1, 6)
      }
    }
    box(group, METAL, 1.4, 1.9, 0.6, cx + w * 0.3, 0.95, cz + d * 0.3)
    ceilingPipes(group, cx, cz, w, d, h)
    hazardStripes(group, cx, cz, w)
  },

  engine(group, cx, cz, w, d, h) {
    // A big horizontal turbine flanked by pipework.
    const engine = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, d * 0.6, 18), METAL)
    engine.rotation.x = Math.PI / 2
    engine.position.set(cx, 1.35, cz)
    group.add(engine)
    cylinder(group, REACTOR_CORE, 0.62, 0.62, 0.22, cx, 1.35, cz + d * 0.3, 18).rotation.x = Math.PI / 2
    for (const side of [-1, 1]) {
      cylinder(group, PIPE, 0.2, 0.2, d * 0.8, cx + side * w * 0.3, 0.75, cz, 10).rotation.x = Math.PI / 2
      box(group, DARK_METAL, 0.7, 1.5, 0.7, cx + side * w * 0.34, 0.75, cz - d * 0.32)
    }
    ceilingPipes(group, cx, cz, w, d, h)
  },

  security(group, cx, cz, w, d) {
    // The camera room: a wall of monitors and one chair.
    for (let row = 0; row < 2; row += 1) {
      for (let col = -1; col <= 1; col += 1) {
        box(group, col === 0 ? SCREEN_BLUE : SCREEN_GREEN, 0.75, 0.55, 0.08, cx + col * 0.85, 1.15 + row * 0.65, cz - d * 0.44)
      }
    }
    box(group, DARK_METAL, w * 0.75, 0.85, 0.5, cx, 0.42, cz - d * 0.3)
    cylinder(group, RUBBER, 0.4, 0.45, 0.5, cx, 0.25, cz + 0.2, 14)
  },

  reactor(group, cx, cz, w, d, h) {
    // A glowing core column with a containment ring.
    cylinder(group, DARK_METAL, 1.5, 1.7, 0.35, cx, 0.175, cz, 24)
    cylinder(group, REACTOR_CORE, 0.85, 0.85, h - 1.0, cx, (h - 1.0) / 2 + 0.35, cz, 20)
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.12, 8, 24), METAL)
    ring.rotation.x = Math.PI / 2
    ring.position.set(cx, 1.6, cz)
    group.add(ring)
    for (const side of [-1, 1]) {
      consoleBank(group, cx + side * w * 0.34, cz + d * 0.25, 1.8, side > 0 ? -0.5 : 0.5, SCREEN_AMBER)
    }
    ceilingPipes(group, cx, cz, w, d, h)
  },

  medbay(group, cx, cz, w, d) {
    // Beds and a scanner pad.
    for (const oz of [-0.22, 0.16]) {
      const bz = cz + oz * d
      box(group, WHITE_PANEL, 1.0, 0.55, 2.1, cx - w * 0.28, 0.5, bz)
      box(group, GLASS, 0.9, 0.06, 1.9, cx - w * 0.28, 0.8, bz)
    }
    cylinder(group, WHITE_PANEL, 1.0, 1.0, 0.14, cx + w * 0.25, 0.07, cz, 20)
    const scanner = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 2.1, 20, 1, true), GLASS)
    scanner.position.set(cx + w * 0.25, 1.15, cz)
    group.add(scanner)
    consoleBank(group, cx + w * 0.25, cz - d * 0.34, 1.6, 0, SCREEN_GREEN)
  },

  admin(group, cx, cz, w, d) {
    // The map table plus a card reader.
    box(group, DARK_METAL, 3.2, 0.75, 2.0, cx, 0.375, cz)
    box(group, SCREEN_BLUE, 2.9, 0.06, 1.75, cx, 0.78, cz)
    for (const ox of [-0.3, 0.3]) {
      cylinder(group, RUBBER, 0.28, 0.28, 0.45, cx + ox * w, 0.225, cz + d * 0.3, 12)
    }
    box(group, METAL, 0.6, 1.1, 0.45, cx + w * 0.34, 0.55, cz - d * 0.3)
    box(group, SCREEN_AMBER, 0.4, 0.25, 0.05, cx + w * 0.34, 0.85, cz - d * 0.3 - 0.24)
  },
}

export function addRoomProps(decorGroup, room) {
  const build = THEMES[room.theme]
  if (!build) return
  const [width, height, depth] = room.size
  const [cx, , cz] = room.center
  build(decorGroup, cx, cz, width, depth, height)
}
