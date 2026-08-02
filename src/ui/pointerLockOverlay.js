export function initPointerLockOverlay(domElement) {
  const overlay = document.createElement('div')
  overlay.textContent = 'Click to play'
  overlay.style.position = 'fixed'
  overlay.style.inset = '0'
  overlay.style.display = 'flex'
  overlay.style.alignItems = 'center'
  overlay.style.justifyContent = 'center'
  overlay.style.fontFamily = 'sans-serif'
  overlay.style.fontSize = '2rem'
  overlay.style.color = '#fff'
  overlay.style.background = 'rgba(0, 0, 0, 0.6)'
  overlay.style.cursor = 'pointer'
  overlay.style.userSelect = 'none'
  document.body.appendChild(overlay)

  const listeners = []

  overlay.addEventListener('click', () => {
    domElement.requestPointerLock()
  })

  document.addEventListener('pointerlockchange', () => {
    const isLocked = document.pointerLockElement === domElement
    overlay.style.display = isLocked ? 'none' : 'flex'
    for (const listener of listeners) {
      listener(isLocked)
    }
  })

  return {
    onLockChange(callback) {
      listeners.push(callback)
    },
  }
}
