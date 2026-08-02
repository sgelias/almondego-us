import { getSpellById } from '../../shared/spellPool.js'
import { COLORS } from '../ui/theme.js'

// Shows which spell you were dealt and whether the charge is still there,
// plus the blinding white-out when someone casts Clarão near you.
const BLIND_FADE_MS = 400

export function createSpellUI() {
  const blind = document.createElement('div')
  blind.style.position = 'fixed'
  blind.style.inset = '0'
  blind.style.pointerEvents = 'none'
  blind.style.background = '#ffffff'
  blind.style.opacity = '0'
  blind.style.zIndex = '21'
  document.body.appendChild(blind)

  const panel = document.createElement('div')
  panel.style.position = 'fixed'
  panel.style.right = '1rem'
  panel.style.bottom = '1rem'
  panel.style.display = 'none'
  panel.style.maxWidth = 'min(18rem, 45vw)'
  panel.style.padding = '0.6rem 0.85rem'
  panel.style.background = 'rgba(0,0,0,0.55)'
  panel.style.borderRadius = '10px'
  panel.style.border = `1px solid ${COLORS.panelBorder}`
  panel.style.fontFamily = 'system-ui, -apple-system, "Segoe UI", sans-serif'
  panel.style.color = COLORS.ink
  document.body.appendChild(panel)

  let spellId = null
  let spent = false

  function render() {
    const spell = getSpellById(spellId)
    panel.innerHTML = ''
    if (!spell) {
      panel.style.display = 'none'
      return
    }
    panel.style.display = 'block'
    panel.style.opacity = spent ? '0.5' : '1'

    const title = document.createElement('div')
    title.textContent = `Q — ${spell.name}`
    title.style.fontWeight = '700'
    title.style.color = spent ? COLORS.muted : COLORS.accent
    panel.appendChild(title)

    const body = document.createElement('div')
    body.textContent = spent ? 'Já usada nesta partida.' : spell.description
    body.style.fontSize = '0.82rem'
    body.style.color = COLORS.muted
    body.style.marginTop = '0.15rem'
    panel.appendChild(body)
  }

  return {
    setSpell(id) {
      spellId = id
      spent = false
      render()
    },
    markSpent() {
      spent = true
      render()
    },
    isSpent() {
      return spent
    },
    hasSpell() {
      return Boolean(getSpellById(spellId))
    },
    hide() {
      panel.style.display = 'none'
      blind.style.opacity = '0'
    },

    // The white-out for someone else's Clarão.
    blindFor(seconds) {
      blind.style.transition = 'opacity 80ms ease-in'
      blind.style.opacity = '1'
      setTimeout(() => {
        blind.style.transition = `opacity ${Math.max(200, seconds * 1000 - 80)}ms ease-out`
        blind.style.opacity = '0'
      }, 80)
    },
  }
}
