import { colorForIndex } from '../net/playerAvatar.js'
import { COLORS } from './theme.js'

// A top-down map drawn from the same ROOM_LAYOUT and corridor data the 3D
// world is built from, so it can never disagree with the level - adding a
// room or an arena updates the map for free.
//
// What it shows about other players is deliberately limited to what limited
// vision already reveals: a marker appears only for someone you can
// currently see. Otherwise the map would quietly hand back exactly the
// information the vision rule exists to take away.

const PADDING = 10
const ROOM_LABELS = {
  cafeteria: 'Refeitório',
  weapons: 'Armas',
  navigation: 'Navegação',
  o2: 'O2',
  shields: 'Escudos',
  communications: 'Comunicação',
  storage: 'Depósito',
  electrical: 'Elétrica',
  lowerEngine: 'Motor Inf.',
  upperEngine: 'Motor Sup.',
  security: 'Segurança',
  reactor: 'Reator',
  medbay: 'Enfermaria',
  admin: 'Admin',
}

function computeBounds(roomLayout) {
  let xMin = Infinity
  let xMax = -Infinity
  let zMin = Infinity
  let zMax = -Infinity
  for (const room of roomLayout) {
    xMin = Math.min(xMin, room.center[0] - room.size[0] / 2)
    xMax = Math.max(xMax, room.center[0] + room.size[0] / 2)
    zMin = Math.min(zMin, room.center[2] - room.size[2] / 2)
    zMax = Math.max(zMax, room.center[2] + room.size[2] / 2)
  }
  return { xMin: xMin - PADDING, xMax: xMax + PADDING, zMin: zMin - PADDING, zMax: zMax + PADDING }
}

export function createMinimap(roomLayout, corridors, { corridorWidth = 4 } = {}) {
  const bounds = computeBounds(roomLayout)
  const worldWidth = bounds.xMax - bounds.xMin
  const worldDepth = bounds.zMax - bounds.zMin

  const panel = document.createElement('div')
  panel.style.position = 'fixed'
  panel.style.inset = '0'
  panel.style.display = 'none'
  panel.style.alignItems = 'center'
  panel.style.justifyContent = 'center'
  panel.style.background = 'rgba(6, 9, 14, 0.82)'
  panel.style.zIndex = '14'
  panel.style.fontFamily = 'system-ui, -apple-system, "Segoe UI", sans-serif'

  const frame = document.createElement('div')
  frame.style.background = COLORS.panel
  frame.style.border = `1px solid ${COLORS.panelBorder}`
  frame.style.borderRadius = '14px'
  frame.style.padding = '1rem'
  frame.style.boxShadow = '0 18px 50px rgba(0,0,0,0.5)'
  panel.appendChild(frame)

  const heading = document.createElement('div')
  heading.textContent = 'Mapa da nave — Tab para fechar'
  heading.style.color = COLORS.accent
  heading.style.textTransform = 'uppercase'
  heading.style.letterSpacing = '0.1em'
  heading.style.fontSize = '0.75rem'
  heading.style.fontWeight = '700'
  heading.style.marginBottom = '0.6rem'
  heading.style.textAlign = 'center'
  frame.appendChild(heading)

  // z grows "north" in world space but downward on screen, so the y axis is
  // flipped when projecting - otherwise the map reads mirrored front-to-back.
  const svgNs = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(svgNs, 'svg')
  svg.setAttribute('viewBox', `0 0 ${worldWidth} ${worldDepth}`)
  svg.style.width = 'min(78vw, 60vh * ' + (worldWidth / worldDepth).toFixed(3) + ')'
  svg.style.maxWidth = '46rem'
  svg.style.height = 'auto'
  svg.style.display = 'block'
  frame.appendChild(svg)

  const toX = (worldX) => worldX - bounds.xMin
  const toY = (worldZ) => bounds.zMax - worldZ

  const staticLayer = document.createElementNS(svgNs, 'g')
  svg.appendChild(staticLayer)
  const markerLayer = document.createElementNS(svgNs, 'g')
  svg.appendChild(markerLayer)

  for (const corridor of corridors) {
    for (let i = 0; i < corridor.points.length - 1; i += 1) {
      const [x1, z1] = corridor.points[i]
      const [x2, z2] = corridor.points[i + 1]
      const line = document.createElementNS(svgNs, 'line')
      line.setAttribute('x1', toX(x1))
      line.setAttribute('y1', toY(z1))
      line.setAttribute('x2', toX(x2))
      line.setAttribute('y2', toY(z2))
      line.setAttribute('stroke', '#2c3a4d')
      line.setAttribute('stroke-width', corridorWidth)
      line.setAttribute('stroke-linecap', 'square')
      staticLayer.appendChild(line)
    }
  }

  for (const room of roomLayout) {
    const rect = document.createElementNS(svgNs, 'rect')
    rect.setAttribute('x', toX(room.center[0] - room.size[0] / 2))
    rect.setAttribute('y', toY(room.center[2] + room.size[2] / 2))
    rect.setAttribute('width', room.size[0])
    rect.setAttribute('height', room.size[2])
    rect.setAttribute('rx', 1.2)
    rect.setAttribute('fill', '#38475c')
    rect.setAttribute('stroke', '#5a6d86')
    rect.setAttribute('stroke-width', 0.5)
    staticLayer.appendChild(rect)

    const label = document.createElementNS(svgNs, 'text')
    label.textContent = ROOM_LABELS[room.id] ?? room.id
    label.setAttribute('x', toX(room.center[0]))
    label.setAttribute('y', toY(room.center[2]) + 1)
    label.setAttribute('text-anchor', 'middle')
    label.setAttribute('fill', '#c3d2e4')
    label.setAttribute('font-size', '2.6')
    staticLayer.appendChild(label)
  }

  function marker(x, z, color, isSelf) {
    const dot = document.createElementNS(svgNs, 'circle')
    dot.setAttribute('cx', toX(x))
    dot.setAttribute('cy', toY(z))
    dot.setAttribute('r', isSelf ? 2.4 : 1.9)
    dot.setAttribute('fill', color)
    dot.setAttribute('stroke', isSelf ? '#ffffff' : 'rgba(0,0,0,0.55)')
    dot.setAttribute('stroke-width', isSelf ? 0.9 : 0.5)
    return dot
  }

  let visible = false

  return {
    isVisible() {
      return visible
    },

    toggle() {
      visible = !visible
      panel.style.display = visible ? 'flex' : 'none'
      return visible
    },

    hide() {
      visible = false
      panel.style.display = 'none'
    },

    // `others` is only the players the caller can currently see - the map
    // does not get privileged information.
    render(selfPosition, selfColorIndex, others) {
      if (!visible) return
      markerLayer.innerHTML = ''
      for (const other of others) {
        markerLayer.appendChild(marker(other.x, other.z, colorForIndex(other.colorIndex ?? 0), false))
      }
      markerLayer.appendChild(marker(selfPosition.x, selfPosition.z, colorForIndex(selfColorIndex ?? 0), true))
    },

    mount() {
      document.body.appendChild(panel)
    },
  }
}
