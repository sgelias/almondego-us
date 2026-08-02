// Venting teleports the camera instantly, which without any feedback just
// looks like the world glitched. This plays a short blackout with a label so
// the jump reads as a deliberate move through a duct.
const BLACKOUT_IN_MS = 130
const HOLD_MS = 120
const FADE_OUT_MS = 320

export function createVentTransition() {
  const overlay = document.createElement('div')
  overlay.style.position = 'fixed'
  overlay.style.inset = '0'
  overlay.style.background = '#000'
  overlay.style.opacity = '0'
  overlay.style.pointerEvents = 'none'
  overlay.style.zIndex = '18'
  overlay.style.display = 'flex'
  overlay.style.alignItems = 'center'
  overlay.style.justifyContent = 'center'

  const label = document.createElement('div')
  label.textContent = 'Entrando no duto…'
  label.style.color = '#8fe6ff'
  label.style.fontFamily = 'sans-serif'
  label.style.fontSize = '1.6rem'
  label.style.letterSpacing = '0.12em'
  label.style.textTransform = 'uppercase'
  label.style.opacity = '0'
  label.style.transition = `opacity ${BLACKOUT_IN_MS}ms ease-out`
  overlay.appendChild(label)

  document.body.appendChild(overlay)

  let timers = []

  function clearTimers() {
    for (const timer of timers) clearTimeout(timer)
    timers = []
  }

  return {
    // onMidpoint runs while the screen is fully black - the caller moves the
    // camera there so the teleport itself is never visible.
    play(onMidpoint) {
      clearTimers()
      overlay.style.transition = `opacity ${BLACKOUT_IN_MS}ms ease-in`
      overlay.style.opacity = '1'
      label.style.opacity = '1'

      timers.push(
        setTimeout(() => {
          onMidpoint?.()
        }, BLACKOUT_IN_MS)
      )
      timers.push(
        setTimeout(() => {
          overlay.style.transition = `opacity ${FADE_OUT_MS}ms ease-out`
          overlay.style.opacity = '0'
          label.style.opacity = '0'
        }, BLACKOUT_IN_MS + HOLD_MS)
      )
    },
  }
}
