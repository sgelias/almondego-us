import { COLORS } from '../ui/theme.js'

// Health readout plus the hit feedback. Splitting these would mean two
// modules that both have to know MAX_HEALTH and both mount an overlay; the
// flash is only ever triggered by losing health, so they belong together.
const FLASH_MS = 320

export function createHealthUI() {
  const flash = document.createElement('div')
  flash.style.position = 'fixed'
  flash.style.inset = '0'
  flash.style.pointerEvents = 'none'
  flash.style.opacity = '0'
  flash.style.zIndex = '19'
  // A vignette rather than a flat wash: it reads as "I am being hurt"
  // without hiding the room you are trying to escape through.
  flash.style.background = 'radial-gradient(circle at 50% 50%, rgba(255,0,0,0) 35%, rgba(255,20,20,0.75) 100%)'
  flash.style.transition = `opacity ${FLASH_MS}ms ease-out`
  document.body.appendChild(flash)

  const panel = document.createElement('div')
  panel.style.position = 'fixed'
  panel.style.left = '1rem'
  panel.style.bottom = '1rem'
  panel.style.display = 'none'
  panel.style.alignItems = 'center'
  panel.style.gap = '0.45rem'
  panel.style.padding = '0.5rem 0.8rem'
  panel.style.background = 'rgba(0,0,0,0.5)'
  panel.style.borderRadius = '10px'
  panel.style.fontFamily = 'system-ui, -apple-system, "Segoe UI", sans-serif'
  panel.style.color = COLORS.ink
  panel.style.fontWeight = '700'
  panel.style.letterSpacing = '0.06em'
  document.body.appendChild(panel)

  // Hit marker for the attacker. Landing a blow used to produce no feedback
  // whatsoever - no sound, no mark, nothing on screen - so an impostor
  // pressing E could not tell an attack from a dead key. Only the victim's
  // hearts changed, and those sit above their head, behind the crosshair.
  const marker = document.createElement('div')
  marker.textContent = '✕'
  marker.style.position = 'fixed'
  marker.style.left = '50%'
  marker.style.top = '50%'
  marker.style.transform = 'translate(-50%, -50%)'
  marker.style.pointerEvents = 'none'
  marker.style.zIndex = '19'
  marker.style.color = '#ff5252'
  marker.style.fontSize = '2.4rem'
  marker.style.fontWeight = '900'
  marker.style.textShadow = '0 0 8px rgba(0,0,0,0.8)'
  marker.style.opacity = '0'
  document.body.appendChild(marker)

  let maxHealth = 3

  function render(health) {
    panel.innerHTML = ''
    const label = document.createElement('span')
    label.textContent = 'VIDA'
    label.style.fontSize = '0.7rem'
    label.style.color = COLORS.muted
    panel.appendChild(label)

    for (let i = 0; i < maxHealth; i += 1) {
      const pip = document.createElement('span')
      const filled = i < health
      pip.textContent = filled ? '♥' : '♡'
      pip.style.fontSize = '1.25rem'
      pip.style.color = filled ? (health === 1 ? '#ff4d4d' : '#ff7b7b') : '#4a5666'
      panel.appendChild(pip)
    }
  }

  return {
    show(startingHealth, max) {
      maxHealth = max ?? maxHealth
      panel.style.display = 'flex'
      render(startingHealth ?? maxHealth)
    },

    set(health) {
      render(health)
    },

    hit(health) {
      render(health)
      flash.style.transition = 'opacity 60ms ease-in'
      flash.style.opacity = '1'
      setTimeout(() => {
        flash.style.transition = `opacity ${FLASH_MS}ms ease-out`
        flash.style.opacity = '0'
      }, 60)
    },

    // Feedback for the attacker: their blow landed, and how much is left.
    enemyHit(remaining) {
      marker.textContent = remaining > 0 ? '✕' : '☠'
      marker.style.transition = 'opacity 40ms ease-in, transform 40ms ease-in'
      marker.style.opacity = '1'
      marker.style.transform = 'translate(-50%, -50%) scale(1.35)'
      setTimeout(() => {
        marker.style.transition = 'opacity 260ms ease-out, transform 260ms ease-out'
        marker.style.opacity = '0'
        marker.style.transform = 'translate(-50%, -50%) scale(1)'
      }, 60)
    },

    hide() {
      panel.style.display = 'none'
      flash.style.opacity = '0'
      marker.style.opacity = '0'
    },
  }
}
