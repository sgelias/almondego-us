import { COLORS } from '../ui/theme.js'

// What you are carrying, for two-step tasks. Without it a player who picked
// up a fuse walks across the ship holding something they cannot name and
// with no reminder of why they are going anywhere.
export function createCarryUI() {
  const panel = document.createElement('div')
  panel.style.position = 'fixed'
  panel.style.left = '50%'
  panel.style.bottom = '1rem'
  panel.style.transform = 'translateX(-50%)'
  panel.style.display = 'none'
  panel.style.alignItems = 'center'
  panel.style.gap = '0.5rem'
  panel.style.padding = '0.45rem 0.9rem'
  panel.style.background = 'rgba(0,0,0,0.55)'
  panel.style.border = `1px solid ${COLORS.panelBorder}`
  panel.style.borderRadius = '999px'
  panel.style.color = COLORS.ink
  panel.style.fontFamily = 'system-ui, -apple-system, "Segoe UI", sans-serif'
  panel.style.fontWeight = '600'
  panel.style.pointerEvents = 'none'
  panel.style.zIndex = '13'
  document.body.appendChild(panel)

  return {
    set(itemName) {
      if (!itemName) {
        panel.style.display = 'none'
        return
      }
      panel.innerHTML = ''
      const icon = document.createElement('span')
      icon.textContent = '📦'
      panel.appendChild(icon)
      const label = document.createElement('span')
      label.textContent = `Carregando: ${itemName}`
      panel.appendChild(label)
      panel.style.display = 'flex'
    },
  }
}
