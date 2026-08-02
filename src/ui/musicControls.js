import { COLORS } from './theme.js'

// Volume control for the background music.
//
// The keyboard is the primary path, not a nicety: while the match is running
// the pointer is locked, so a slider cannot be clicked at all. Keys work at
// any moment; the slider lives on the pause screen, where the mouse is free.

const STEP = 0.05

function readout(volume) {
  if (volume === 0) return 'Música: sem som'
  return `Música: ${Math.round(volume * 100)}%`
}

export function createMusicControls(music) {
  // Transient corner readout, so pressing a volume key gives feedback even
  // with the pointer locked and no slider on screen.
  const badge = document.createElement('div')
  badge.style.position = 'fixed'
  badge.style.left = '50%'
  badge.style.bottom = '12%'
  badge.style.transform = 'translateX(-50%)'
  badge.style.padding = '0.45rem 1rem'
  badge.style.borderRadius = '999px'
  badge.style.background = 'rgba(8, 12, 18, 0.85)'
  badge.style.border = `1px solid ${COLORS.controlBorder}`
  badge.style.color = COLORS.ink
  badge.style.fontFamily = 'sans-serif'
  badge.style.fontSize = '0.9rem'
  badge.style.pointerEvents = 'none'
  badge.style.opacity = '0'
  badge.style.zIndex = '14'
  document.body.appendChild(badge)

  let hideTimer = null
  function flash() {
    badge.textContent = readout(music.getVolume())
    badge.style.opacity = '1'
    clearTimeout(hideTimer)
    hideTimer = setTimeout(() => {
      badge.style.opacity = '0'
    }, 1200)
  }

  // The pause-screen slider.
  const panel = document.createElement('div')
  panel.style.display = 'flex'
  panel.style.alignItems = 'center'
  panel.style.gap = '0.7rem'
  panel.style.marginTop = '1.6rem'
  panel.style.fontSize = '1rem'
  panel.style.color = COLORS.muted
  panel.style.fontFamily = 'sans-serif'
  // The overlay behind this turns any click into a pointer-lock request;
  // dragging the slider must not also drop the player back into the match.
  for (const type of ['click', 'pointerdown', 'keydown']) {
    panel.addEventListener(type, (event) => event.stopPropagation())
  }

  const label = document.createElement('label')
  label.textContent = 'Música'
  panel.appendChild(label)

  const slider = document.createElement('input')
  slider.type = 'range'
  slider.min = '0'
  slider.max = '1'
  slider.step = '0.01'
  slider.value = String(music.getVolume())
  slider.style.width = '11rem'
  slider.style.cursor = 'pointer'
  panel.appendChild(slider)

  const value = document.createElement('span')
  value.style.minWidth = '5.5rem'
  value.textContent = readout(music.getVolume())
  panel.appendChild(value)

  function sync() {
    slider.value = String(music.getVolume())
    value.textContent = readout(music.getVolume())
  }

  slider.addEventListener('input', () => {
    music.setVolume(Number(slider.value))
    value.textContent = readout(music.getVolume())
  })

  const hint = document.createElement('div')
  hint.textContent = 'M silencia · − e + ajustam durante o jogo'
  hint.style.marginTop = '0.5rem'
  hint.style.fontSize = '0.8rem'
  hint.style.color = COLORS.muted
  hint.style.opacity = '0.75'

  let beforeMute = null

  return {
    panel,
    hint,

    // Returns true when the key was a volume key, so the caller knows the
    // event is spoken for.
    handleKey(event) {
      // The lobby has a text field for the server address: "M" and "-" typed
      // into an IP must stay in the IP.
      const target = event.target
      if (target?.matches?.('input, textarea, select')) return false

      if (event.code === 'KeyM') {
        if (music.getVolume() > 0) {
          beforeMute = music.getVolume()
          music.setVolume(0)
        } else {
          music.setVolume(beforeMute ?? 0.15)
        }
      } else if (event.code === 'Minus' || event.code === 'NumpadSubtract') {
        music.setVolume(music.getVolume() - STEP)
      } else if (event.code === 'Equal' || event.code === 'NumpadAdd') {
        music.setVolume(music.getVolume() + STEP)
      } else {
        return false
      }

      sync()
      flash()
      return true
    },
  }
}
