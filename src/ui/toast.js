import { COLORS } from './theme.js'

// Errors from the server used to be routed to the lobby's error line. Once
// the match starts the lobby overlay is removed from the DOM, so any error
// after that point was written into a detached element and never seen -
// which turns a rejected action into "the button does nothing". This is the
// in-game equivalent: always visible, always attached.
const VISIBLE_MS = 5000

export function createToast() {
  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.top = '1rem'
  container.style.left = '50%'
  container.style.transform = 'translateX(-50%)'
  container.style.display = 'flex'
  container.style.flexDirection = 'column'
  container.style.gap = '0.4rem'
  container.style.alignItems = 'center'
  container.style.pointerEvents = 'none'
  // Above every gameplay overlay, including the game-over screen (25), so a
  // rejected restart is actually readable.
  container.style.zIndex = '30'
  container.style.fontFamily = 'system-ui, -apple-system, "Segoe UI", sans-serif'
  document.body.appendChild(container)

  return {
    show(message, { tone = 'error' } = {}) {
      const item = document.createElement('div')
      item.textContent = message
      item.style.background = 'rgba(12, 16, 22, 0.94)'
      item.style.border = `1px solid ${tone === 'error' ? COLORS.danger : COLORS.panelBorder}`
      item.style.color = tone === 'error' ? COLORS.danger : COLORS.ink
      item.style.padding = '0.6rem 1rem'
      item.style.borderRadius = '10px'
      item.style.fontWeight = '600'
      item.style.boxShadow = '0 10px 30px rgba(0,0,0,0.45)'
      container.appendChild(item)
      setTimeout(() => item.remove(), VISIBLE_MS)
    },
  }
}
