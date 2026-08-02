function styleOverlay(el) {
  el.style.position = 'fixed'
  el.style.inset = '0'
  el.style.display = 'flex'
  el.style.flexDirection = 'column'
  el.style.alignItems = 'center'
  el.style.justifyContent = 'center'
  el.style.gap = '0.75rem'
  el.style.background = 'rgba(10, 12, 16, 0.95)'
  el.style.color = '#fff'
  el.style.fontFamily = 'sans-serif'
  el.style.zIndex = '10'
}

export function showLobby({ onHostAndJoin, onJoin, onStart }) {
  const overlay = document.createElement('div')
  styleOverlay(overlay)

  const title = document.createElement('h1')
  title.textContent = 'Among Us: First Person'
  overlay.appendChild(title)

  const nameInput = document.createElement('input')
  nameInput.type = 'text'
  nameInput.placeholder = 'Your name'
  overlay.appendChild(nameInput)

  const hostButton = document.createElement('button')
  hostButton.textContent = 'Host & Join'
  overlay.appendChild(hostButton)

  const joinRow = document.createElement('div')
  const addressInput = document.createElement('input')
  addressInput.type = 'text'
  addressInput.placeholder = 'Host address (e.g. 192.168.1.10:8080)'
  const joinButton = document.createElement('button')
  joinButton.textContent = 'Join'
  joinRow.appendChild(addressInput)
  joinRow.appendChild(joinButton)
  overlay.appendChild(joinRow)

  const errorMessage = document.createElement('div')
  errorMessage.style.color = '#ff6b6b'
  errorMessage.style.display = 'none'
  overlay.appendChild(errorMessage)

  const playerList = document.createElement('ul')
  overlay.appendChild(playerList)

  const startButton = document.createElement('button')
  startButton.textContent = 'Start Game'
  startButton.style.display = 'none'
  overlay.appendChild(startButton)

  document.body.appendChild(overlay)

  hostButton.addEventListener('click', () => {
    onHostAndJoin(nameInput.value.trim() || 'Player')
  })

  joinButton.addEventListener('click', () => {
    onJoin(addressInput.value.trim(), nameInput.value.trim() || 'Player')
  })

  startButton.addEventListener('click', () => {
    onStart()
  })

  return {
    setPlayers(players) {
      playerList.innerHTML = ''
      for (const player of players) {
        const item = document.createElement('li')
        item.textContent = player.name
        playerList.appendChild(item)
      }
    },
    setIsHost(isHost) {
      startButton.style.display = isHost ? 'block' : 'none'
    },
    showConnectionError(message) {
      errorMessage.textContent = message
      errorMessage.style.display = 'block'
    },
    hide() {
      overlay.remove()
    },
  }
}
