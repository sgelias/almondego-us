import * as THREE from 'three'

// The view out of the ship.
//
// Procedural, like the textures and the sound: no asset to fetch, no build
// step (AD-003). Two shells of points at different sizes and brightnesses,
// which is enough to read as depth - a single uniform layer looks like
// noise on the glass rather than distance.
//
// Everything here sets fog: false. The scene fog exists to hide the far end
// of a corridor; applied to stars it would erase them completely, since they
// sit far beyond the fog's far plane by design.

const RADIUS = 400

function shell({ count, size, colorSpread, brightness, randomFn }) {
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const color = new THREE.Color()

  for (let i = 0; i < count; i += 1) {
    // Uniform on a sphere: naive lat/long sampling bunches stars at the
    // poles, which reads as two bright smudges directly above and below.
    const u = randomFn() * 2 - 1
    const theta = randomFn() * Math.PI * 2
    const r = Math.sqrt(1 - u * u)
    positions[i * 3] = RADIUS * r * Math.cos(theta)
    positions[i * 3 + 1] = RADIUS * u
    positions[i * 3 + 2] = RADIUS * r * Math.sin(theta)

    // Mostly white, a few warm and a few blue - real starfields are not
    // monochrome and the eye notices.
    const hue = 0.55 + (randomFn() - 0.5) * colorSpread
    const saturation = randomFn() < 0.75 ? 0.05 : 0.45
    color.setHSL(hue, saturation, brightness * (0.6 + randomFn() * 0.4))
    colors[i * 3] = color.r
    colors[i * 3 + 1] = color.g
    colors[i * 3 + 2] = color.b
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size,
      sizeAttenuation: false,
      vertexColors: true,
      fog: false,
      transparent: true,
      depthWrite: false,
    })
  )
}

export function createStarfield(randomFn = Math.random) {
  const group = new THREE.Group()
  // Drawn before everything else and never occluding it: the sky is behind
  // the ship no matter what the depth buffer thinks about a 400-unit sphere.
  group.renderOrder = -1
  group.add(shell({ count: 1400, size: 1.4, colorSpread: 0.5, brightness: 0.75, randomFn }))
  group.add(shell({ count: 500, size: 2.6, colorSpread: 0.7, brightness: 0.95, randomFn }))

  return {
    group,
    // The stars must never get closer. Without this the player could walk
    // "out" to the edge of the sphere and watch the sky slide past like
    // scenery, which instantly reads as a painted backdrop.
    follow(camera) {
      group.position.copy(camera.position)
    },
  }
}
