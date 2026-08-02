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
  title.textContent = 'Among Us: Primeira Pessoa'
  overlay.appendChild(title)

  const nameInput = document.createElement('input')
  nameInput.type = 'text'
  nameInput.placeholder = 'Seu nome'
  overlay.appendChild(nameInput)

  const hostButton = document.createElement('button')
  hostButton.textContent = 'Hospedar e Entrar'
  overlay.appendChild(hostButton)

  const joinRow = document.createElement('div')
  const addressInput = document.createElement('input')
  addressInput.type = 'text'
  addressInput.placeholder = 'Endereço do host (ex: 192.168.1.10:8080)'
  const joinButton = document.createElement('button')
  joinButton.textContent = 'Entrar'
  joinRow.appendChild(addressInput)
  joinRow.appendChild(joinButton)
  overlay.appendChild(joinRow)

  const errorMessage = document.createElement('div')
  errorMessage.style.color = '#ff6b6b'
  errorMessage.style.display = 'none'
  overlay.appendChild(errorMessage)

  const playerList = document.createElement('ul')
  overlay.appendChild(playerList)

  // The research challenge lives here rather than on an in-match console:
  // looking something up takes minutes, and standing still at a console is
  // exactly when the Impostor kills you (AD-008).
  const research = document.createElement('div')
  research.style.maxWidth = 'min(34rem, 85vw)'
  research.style.background = 'rgba(255,255,255,0.06)'
  research.style.border = '1px solid #2f3b4c'
  research.style.borderRadius = '10px'
  research.style.padding = '1rem 1.2rem'
  research.style.display = 'none'
  overlay.appendChild(research)

  const startButton = document.createElement('button')
  startButton.textContent = 'Iniciar Partida'
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
    // Shows the pre-match research question. Answering is optional and never
    // blocks the match - it's a "while you wait" challenge, so a wrong answer
    // just reveals the right one and explains it.
    showResearchChallenge(question) {
      research.innerHTML = ''
      research.style.display = 'block'

      const title = document.createElement('div')
      title.textContent = question.title
      title.style.color = '#8fd3ff'
      title.style.letterSpacing = '0.08em'
      title.style.textTransform = 'uppercase'
      title.style.fontSize = '0.78rem'
      title.style.marginBottom = '0.4rem'
      research.appendChild(title)

      const prompt = document.createElement('div')
      prompt.textContent = question.prompt
      prompt.style.fontWeight = '600'
      prompt.style.marginBottom = '0.3rem'
      research.appendChild(prompt)

      const hint = document.createElement('div')
      hint.textContent = question.hint
      hint.style.color = '#b6c6d8'
      hint.style.fontSize = '0.85rem'
      hint.style.marginBottom = '0.7rem'
      research.appendChild(hint)

      const feedback = document.createElement('div')
      feedback.style.marginTop = '0.6rem'
      feedback.style.fontWeight = '600'

      const buttons = []
      question.options.forEach((option, index) => {
        const button = document.createElement('button')
        button.textContent = option
        button.style.display = 'block'
        button.style.width = '100%'
        button.style.textAlign = 'left'
        button.style.margin = '0.25rem 0'
        button.style.padding = '0.5rem 0.7rem'
        button.style.borderRadius = '7px'
        button.style.border = '2px solid #3d4a5c'
        button.style.background = '#1b2431'
        button.style.color = '#eaf2ff'
        button.style.cursor = 'pointer'
        button.style.fontFamily = 'inherit'
        button.addEventListener('click', () => {
          for (const other of buttons) other.disabled = true
          const correct = index === question.answerIndex
          button.style.borderColor = correct ? '#3ddc84' : '#ff6b6b'
          if (!correct) buttons[question.answerIndex].style.borderColor = '#3ddc84'
          feedback.textContent = correct
            ? 'Isso mesmo! Boa pesquisa.'
            : `Quase! A resposta certa é "${question.options[question.answerIndex]}".`
          feedback.style.color = correct ? '#3ddc84' : '#ffc266'
        })
        research.appendChild(button)
        buttons.push(button)
      })

      research.appendChild(feedback)
    },

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
