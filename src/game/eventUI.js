import { COLORS, createCountdownBar } from '../ui/theme.js'

// The banner for a ship emergency. Deliberately at the top and narrow: it
// has to be readable at a glance mid-run without covering the room you are
// running through - unlike the meeting screens, the game does not stop for
// this one.
export function createEventUI() {
  const banner = document.createElement('div')
  banner.style.position = 'fixed'
  banner.style.top = '1rem'
  banner.style.left = '50%'
  banner.style.transform = 'translateX(-50%)'
  banner.style.display = 'none'
  banner.style.flexDirection = 'column'
  banner.style.alignItems = 'center'
  banner.style.gap = '0.3rem'
  banner.style.padding = '0.7rem 1.2rem'
  banner.style.background = 'rgba(30, 10, 6, 0.92)'
  banner.style.border = '1px solid #b4531d'
  banner.style.borderRadius = '12px'
  banner.style.color = COLORS.ink
  banner.style.fontFamily = 'system-ui, -apple-system, "Segoe UI", sans-serif'
  banner.style.pointerEvents = 'none'
  banner.style.zIndex = '17'
  banner.style.maxWidth = 'min(30rem, 90vw)'
  banner.style.textAlign = 'center'
  document.body.appendChild(banner)

  // A red pulse over the whole screen while an emergency runs, so you know
  // something is wrong even when looking away from the banner.
  const tint = document.createElement('div')
  tint.style.position = 'fixed'
  tint.style.inset = '0'
  tint.style.pointerEvents = 'none'
  tint.style.zIndex = '11'
  tint.style.opacity = '0'
  tint.style.background = 'radial-gradient(circle at 50% 50%, rgba(255,60,0,0) 45%, rgba(255,70,0,0.35) 100%)'
  document.body.appendChild(tint)

  let pulse = null

  return {
    show({ name, description, durationSeconds }) {
      banner.innerHTML = ''
      banner.style.display = 'flex'

      const title = document.createElement('div')
      title.textContent = `⚠ ${name}`
      title.style.fontWeight = '800'
      title.style.color = '#ffb26b'
      title.style.letterSpacing = '0.04em'
      banner.appendChild(title)

      const body = document.createElement('div')
      body.textContent = description
      body.style.fontSize = '0.9rem'
      body.style.color = COLORS.ink
      banner.appendChild(body)

      banner.appendChild(createCountdownBar(durationSeconds, 'Resta'))

      pulse?.cancel()
      pulse = tint.animate?.([{ opacity: 0.25 }, { opacity: 0.7 }, { opacity: 0.25 }], {
        duration: 1600,
        iterations: Infinity,
      })
      tint.style.opacity = '0.35'
    },

    // Shown briefly when the emergency resolves, so the outcome registers.
    showOutcome(name, fixed) {
      banner.innerHTML = ''
      banner.style.display = 'flex'
      const title = document.createElement('div')
      title.textContent = fixed ? `✓ ${name} resolvida!` : `✗ ${name} não foi resolvida`
      title.style.fontWeight = '800'
      title.style.color = fixed ? COLORS.good : COLORS.danger
      banner.appendChild(title)

      pulse?.cancel()
      pulse = null
      tint.style.opacity = '0'
      setTimeout(() => {
        banner.style.display = 'none'
      }, 2600)
    },

    hide() {
      banner.style.display = 'none'
      pulse?.cancel()
      pulse = null
      tint.style.opacity = '0'
    },
  }
}
