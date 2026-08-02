import { colorForIndex } from '../net/playerAvatar.js'

// A 2D crewmate for the HTML screens (lobby, voting, game over), matching
// the 3D avatar's colour so a player is recognisable in both. Drawn as
// inline SVG rather than a canvas or an image so it scales cleanly at any
// size and costs nothing to create.

function darken(hex, amount) {
  const r = Math.round(((hex >> 16) & 0xff) * amount)
  const g = Math.round(((hex >> 8) & 0xff) * amount)
  const b = Math.round((hex & 0xff) * amount)
  return `rgb(${r},${g},${b})`
}

function toCss(hex) {
  return `#${hex.toString(16).padStart(6, '0')}`
}

export function crewmateSvg(colorIndex, size = 40, { dead = false } = {}) {
  const hex = Number.isInteger(colorIndex) ? colorForIndex(colorIndex) : 0x8899aa
  const body = toCss(hex)
  const shade = darken(hex, 0.65)

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 64 76')
  svg.setAttribute('width', String(size))
  svg.setAttribute('height', String(Math.round((size * 76) / 64)))
  svg.style.flexShrink = '0'
  if (dead) svg.style.opacity = '0.35'

  svg.innerHTML = `
    <rect x="3" y="28" width="13" height="26" rx="6.5" fill="${shade}"/>
    <path d="M16 32a18 18 0 0 1 36 0v24a8 8 0 0 1-8 8H24a8 8 0 0 1-8-8z" fill="${body}"/>
    <rect x="20" y="60" width="12" height="13" rx="4" fill="${body}"/>
    <rect x="36" y="60" width="12" height="13" rx="4" fill="${body}"/>
    <path d="M28 27a11 8 0 0 1 22 1a11 8 0 0 1-22-1z" fill="#a9dcf0"/>
    <path d="M31 25a6 4 0 0 1 9 0a6 4 0 0 1-9 0z" fill="#d8f1fb" opacity="0.85"/>
  `
  // A dead crewmate is shown lying down and greyed, so the voting screen can
  // distinguish "eliminated" from "still in the game" at a glance.
  if (dead) svg.style.transform = 'rotate(90deg)'
  return svg
}

// Convenience for the common "avatar + name" row used on several screens.
export function crewmateRow(name, colorIndex, { size = 34, dead = false, muted = false } = {}) {
  const row = document.createElement('div')
  row.style.display = 'flex'
  row.style.alignItems = 'center'
  row.style.gap = '0.6rem'
  if (muted) row.style.opacity = '0.55'

  row.appendChild(crewmateSvg(colorIndex, size, { dead }))

  const label = document.createElement('span')
  label.textContent = name
  label.style.fontWeight = '600'
  if (dead) label.style.textDecoration = 'line-through'
  row.appendChild(label)

  return row
}
