import * as THREE from 'three'

// Textures are drawn procedurally into a <canvas> rather than loaded as
// image files: this project has no build step and no asset pipeline, so a
// generated texture keeps everything self-contained and costs one small
// upload per texture instead of a network fetch.
//
// The map modules are also imported by Node verification scripts (floor-gap
// checks, octree timing, overlap checks - the things that have caught the
// worst bugs in this project). Node has no `document`, so texture creation
// degrades to plain colours there rather than throwing and taking those
// checks away.
const canDraw = typeof document !== 'undefined' && typeof document.createElement === 'function'

function makeCanvas(size) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  return canvas
}

function toTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.anisotropy = 4
  return texture
}

function noise(ctx, size, alpha, cell = 2) {
  for (let y = 0; y < size; y += cell) {
    for (let x = 0; x < size; x += cell) {
      const shade = Math.random()
      ctx.fillStyle = `rgba(255,255,255,${(shade * alpha).toFixed(3)})`
      ctx.fillRect(x, y, cell, cell)
    }
  }
}

// Floor: large panels with recessed seams and a bolt at each corner.
function floorTexture() {
  const size = 256
  const canvas = makeCanvas(size)
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#454f5e'
  ctx.fillRect(0, 0, size, size)
  noise(ctx, size, 0.05, 3)

  ctx.strokeStyle = '#2d3541'
  ctx.lineWidth = 6
  ctx.strokeRect(0, 0, size, size)
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(size / 2, 0)
  ctx.lineTo(size / 2, size)
  ctx.moveTo(0, size / 2)
  ctx.lineTo(size, size / 2)
  ctx.stroke()

  ctx.fillStyle = '#697687'
  for (const [x, y] of [[16, 16], [size - 16, 16], [16, size - 16], [size - 16, size - 16]]) {
    ctx.beginPath()
    ctx.arc(x, y, 4.5, 0, Math.PI * 2)
    ctx.fill()
  }
  return toTexture(canvas)
}

// Wall: vertical panel seams with a rivet strip, plus a darker base band.
function wallTexture() {
  const size = 256
  const canvas = makeCanvas(size)
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#8a97a8'
  ctx.fillRect(0, 0, size, size)
  noise(ctx, size, 0.06, 3)

  ctx.strokeStyle = '#5f6c7d'
  ctx.lineWidth = 5
  for (const x of [0, size / 2, size]) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, size)
    ctx.stroke()
  }

  ctx.fillStyle = '#6d7a8b'
  ctx.fillRect(0, size - 40, size, 40)
  ctx.fillStyle = '#9dabbd'
  for (let x = 18; x < size; x += 36) {
    ctx.beginPath()
    ctx.arc(x, 26, 3.5, 0, Math.PI * 2)
    ctx.fill()
  }
  return toTexture(canvas)
}

// Ceiling: plain dark panels, deliberately low contrast so it recedes.
function ceilingTexture() {
  const size = 128
  const canvas = makeCanvas(size)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#333c48'
  ctx.fillRect(0, 0, size, size)
  noise(ctx, size, 0.04, 4)
  ctx.strokeStyle = '#252c36'
  ctx.lineWidth = 5
  ctx.strokeRect(0, 0, size, size)
  return toTexture(canvas)
}

// Brushed metal for props.
function metalTexture() {
  const size = 128
  const canvas = makeCanvas(size)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#798695'
  ctx.fillRect(0, 0, size, size)
  for (let i = 0; i < 240; i += 1) {
    const y = Math.random() * size
    ctx.strokeStyle = `rgba(255,255,255,${(Math.random() * 0.08).toFixed(3)})`
    ctx.lineWidth = Math.random() * 1.6
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(size, y)
    ctx.stroke()
  }
  return toTexture(canvas)
}

// Null rather than absent when canvas isn't available: three.js accepts
// `map: null` silently but warns on `map: undefined`.
export const TEXTURES = canDraw
  ? { floor: floorTexture(), wall: wallTexture(), ceiling: ceilingTexture(), metal: metalTexture() }
  : { floor: null, wall: null, ceiling: null, metal: null }

// A BoxGeometry gives every face UVs spanning 0..1, so a shared texture
// stretches differently on a 14-unit floor than on a 0.3-unit trim piece.
// Rewriting the UVs per face using that face's real dimensions makes one
// texture tile at a consistent world scale everywhere - which is what lets
// every wall in the map share a single material and a single GPU texture.
export function applyBoxUvScale(geometry, width, height, depth, unitsPerTile = 4) {
  const uv = geometry.attributes.uv
  if (!uv) return geometry
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z - 4 vertices each.
  const faceSizes = [
    [depth, height],
    [depth, height],
    [width, depth],
    [width, depth],
    [width, height],
    [width, height],
  ]
  for (let face = 0; face < 6; face += 1) {
    const [u, v] = faceSizes[face]
    const su = Math.max(0.05, u / unitsPerTile)
    const sv = Math.max(0.05, v / unitsPerTile)
    for (let i = 0; i < 4; i += 1) {
      const index = face * 4 + i
      uv.setXY(index, uv.getX(index) * su, uv.getY(index) * sv)
    }
  }
  uv.needsUpdate = true
  return geometry
}
