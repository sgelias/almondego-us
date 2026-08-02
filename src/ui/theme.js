// Shared visual language for the HTML screens. Kept as small style-applying
// functions rather than a stylesheet because this project has no build step
// and every overlay is built imperatively - this way one edit changes every
// screen instead of the same colours drifting apart across five files.

export const COLORS = {
  ink: '#eaf2ff',
  muted: '#9fb0c4',
  faint: '#78899d',
  accent: '#8fd3ff',
  danger: '#ff6b6b',
  good: '#3ddc84',
  panel: '#131b26',
  panelBorder: '#2b3646',
  control: '#1b2431',
  controlBorder: '#3d4a5c',
}

export function screenBackdrop(el) {
  el.style.position = 'fixed'
  el.style.inset = '0'
  el.style.display = 'flex'
  el.style.flexDirection = 'column'
  el.style.alignItems = 'center'
  el.style.justifyContent = 'center'
  el.style.gap = '0.75rem'
  el.style.color = COLORS.ink
  el.style.fontFamily = 'system-ui, -apple-system, "Segoe UI", sans-serif'
  // A soft glow behind the content stops the flat wash from looking like an
  // unstyled error page.
  el.style.background =
    'radial-gradient(120% 90% at 50% 0%, #1d2a3b 0%, #0d1219 55%, #070a0e 100%)'
}

export function PANEL(el) {
  el.style.display = 'flex'
  el.style.flexDirection = 'column'
  el.style.gap = '0.55rem'
  el.style.background = COLORS.panel
  el.style.border = `1px solid ${COLORS.panelBorder}`
  el.style.borderRadius = '14px'
  el.style.padding = '1.2rem'
  el.style.width = 'min(24rem, 88vw)'
  el.style.boxShadow = '0 18px 50px rgba(0,0,0,0.45)'
}

function baseButton(el) {
  el.style.padding = '0.7rem 1rem'
  el.style.borderRadius = '10px'
  el.style.fontSize = '1rem'
  el.style.fontWeight = '600'
  el.style.fontFamily = 'inherit'
  el.style.cursor = 'pointer'
  el.style.transition = 'filter 120ms ease, transform 120ms ease'
  el.addEventListener('mouseenter', () => {
    if (!el.disabled) el.style.filter = 'brightness(1.15)'
  })
  el.addEventListener('mouseleave', () => {
    el.style.filter = 'none'
  })
}

export function primaryButton(el) {
  baseButton(el)
  el.style.border = 'none'
  el.style.background = 'linear-gradient(180deg, #3aa0ff 0%, #1d6fd0 100%)'
  el.style.color = '#fff'
}

export function secondaryButton(el) {
  baseButton(el)
  el.style.border = `2px solid ${COLORS.controlBorder}`
  el.style.background = COLORS.control
  el.style.color = COLORS.ink
}

export function dangerButton(el) {
  baseButton(el)
  el.style.border = 'none'
  el.style.background = 'linear-gradient(180deg, #ff6b6b 0%, #c62d2d 100%)'
  el.style.color = '#fff'
}

export function textInput(el) {
  el.style.padding = '0.65rem 0.8rem'
  el.style.borderRadius = '10px'
  el.style.border = `2px solid ${COLORS.controlBorder}`
  el.style.background = '#0f1621'
  el.style.color = COLORS.ink
  el.style.fontSize = '1rem'
  el.style.fontFamily = 'inherit'
  el.style.outline = 'none'
  el.addEventListener('focus', () => {
    el.style.borderColor = COLORS.accent
  })
  el.addEventListener('blur', () => {
    el.style.borderColor = COLORS.controlBorder
  })
}

export function sectionLabel(el) {
  el.style.color = COLORS.accent
  el.style.textTransform = 'uppercase'
  el.style.letterSpacing = '0.1em'
  el.style.fontSize = '0.78rem'
  el.style.fontWeight = '700'
}

// A shrinking bar plus a numeric readout for the meeting/voting countdowns.
//
// The bar is driven by element.animate() rather than a CSS transition. The
// transition version silently did nothing: the element is created detached,
// gets width:100%, is appended, and then a requestAnimationFrame sets it to
// 0% - but the browser may not have computed the initial width by then, so
// it collapses both into one style change and there is nothing to animate
// between. The Web Animations API takes explicit keyframes and does not
// depend on that timing at all.
//
// The number is not redundant: it is the readable fallback if the animation
// is ever suppressed (reduced-motion settings, background tab throttling),
// and "23s" is more actionable than a bar length when you are deciding
// whether there is time to finish reading a question.
export function createCountdownBar(seconds, caption = '') {
  const wrap = document.createElement('div')
  wrap.style.display = 'flex'
  wrap.style.flexDirection = 'column'
  wrap.style.alignItems = 'center'
  wrap.style.gap = '0.35rem'
  wrap.style.width = 'min(26rem, 80vw)'

  const readout = document.createElement('div')
  readout.style.color = COLORS.muted
  readout.style.fontSize = '0.85rem'
  readout.style.fontVariantNumeric = 'tabular-nums'
  wrap.appendChild(readout)

  const track = document.createElement('div')
  track.style.width = '100%'
  track.style.height = '8px'
  track.style.borderRadius = '99px'
  track.style.background = 'rgba(255,255,255,0.12)'
  track.style.overflow = 'hidden'
  wrap.appendChild(track)

  const fill = document.createElement('div')
  fill.style.height = '100%'
  fill.style.width = '100%'
  fill.style.background = `linear-gradient(90deg, ${COLORS.accent}, #3aa0ff)`
  track.appendChild(fill)

  // Optional chaining so the numeric readout really is a fallback rather
  // than being taken down with the animation if animate() is unavailable.
  fill.animate?.([{ width: '100%' }, { width: '0%' }], {
    duration: Math.max(0, seconds) * 1000,
    easing: 'linear',
    fill: 'forwards',
  })

  let remaining = Math.max(0, Math.round(seconds))
  const render = () => {
    readout.textContent = caption ? `${caption} ${Math.max(0, remaining)}s` : `${Math.max(0, remaining)}s`
  }
  render()
  const ticker = setInterval(() => {
    remaining -= 1
    render()
    // Stop once it hits zero, and stop if the bar has been removed from the
    // page - otherwise every meeting leaks an interval that lives until the
    // tab closes.
    if (remaining <= 0 || !wrap.isConnected) clearInterval(ticker)
  }, 1000)

  return wrap
}
