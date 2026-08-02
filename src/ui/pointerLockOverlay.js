export function initPointerLockOverlay(domElement) {
  const overlay = document.createElement('div')
  overlay.textContent = 'Clique para jogar'
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
  const activateListeners = []

  overlay.addEventListener('click', () => {
    // onActivate runs synchronously inside the click handler. Audio
    // specifically needs that: browsers only unlock an AudioContext from a
    // real user gesture, and the 'pointerlockchange' event that fires
    // afterwards no longer counts as one in some of them.
    for (const listener of activateListeners) listener()
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
    onActivate(callback) {
      activateListeners.push(callback)
    },
  }
}
