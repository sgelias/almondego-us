export function initPointerLockOverlay(domElement) {
  const overlay = document.createElement('div')
  overlay.style.position = 'fixed'
  overlay.style.inset = '0'
  overlay.style.display = 'flex'
  overlay.style.flexDirection = 'column'
  overlay.style.alignItems = 'center'
  overlay.style.justifyContent = 'center'
  overlay.style.fontFamily = 'sans-serif'
  overlay.style.fontSize = '2rem'
  overlay.style.color = '#fff'
  overlay.style.background = 'rgba(0, 0, 0, 0.6)'
  overlay.style.cursor = 'pointer'
  overlay.style.userSelect = 'none'

  const title = document.createElement('div')
  title.textContent = 'Clique para jogar'
  overlay.appendChild(title)

  // Anything added here sits on the pause screen. It exists for the volume
  // slider: the pointer is locked during play, so this is the only moment a
  // player can actually use a mouse-driven control.
  const extras = document.createElement('div')
  extras.style.display = 'flex'
  extras.style.flexDirection = 'column'
  extras.style.alignItems = 'center'
  overlay.appendChild(extras)

  document.body.appendChild(overlay)

  const listeners = []
  const activateListeners = []

  overlay.addEventListener('click', (event) => {
    // A click on something added to the pause screen (the volume slider) is
    // not a request to resume the match.
    if (event.target !== overlay && event.target !== title) return

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
    addToPauseScreen(element) {
      extras.appendChild(element)
    },
  }
}
