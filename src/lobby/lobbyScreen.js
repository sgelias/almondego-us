import { crewmateSvg, crewmateRow } from '../ui/crewmateIcon.js'
import { PANEL, primaryButton, secondaryButton, textInput, screenBackdrop } from '../ui/theme.js'

function styleOverlay(el) {
  screenBackdrop(el)
  el.style.zIndex = '10'
  el.style.overflowY = 'auto'
  el.style.padding = '2rem 1rem'
}

export function showLobby({ onHostAndJoin, onJoin, onStart }) {
  const overlay = document.createElement('div')
  styleOverlay(overlay)

  // A row of crewmates over the title, purely to set the tone before the
  // player has seen a single one in 3D.
  const parade = document.createElement('div')
  parade.style.display = 'flex'
  parade.style.gap = '0.35rem'
  parade.style.marginBottom = '0.2rem'
  for (let i = 0; i < 6; i += 1) {
    const icon = crewmateSvg(i, 40)
    icon.style.transform = `translateY(${i % 2 ? 6 : 0}px)`
    parade.appendChild(icon)
  }
  overlay.appendChild(parade)

  const title = document.createElement('h1')
  title.textContent = 'AlmondegoUs'
  title.style.margin = '0'
  title.style.fontSize = 'clamp(1.6rem, 5vw, 2.6rem)'
  title.style.letterSpacing = '0.02em'
  title.style.textAlign = 'center'
  overlay.appendChild(title)

  const subtitle = document.createElement('p')
  subtitle.textContent = 'Cumpra suas tarefas. Descubra o impostor. Ou seja ele.'
  subtitle.style.margin = '0 0 0.4rem'
  subtitle.style.color = '#9fb0c4'
  subtitle.style.textAlign = 'center'
  overlay.appendChild(subtitle)

  const panel = document.createElement('div')
  PANEL(panel)
  overlay.appendChild(panel)

  const nameInput = document.createElement('input')
  nameInput.type = 'text'
  nameInput.placeholder = 'Seu nome'
  textInput(nameInput)
  panel.appendChild(nameInput)

  const hostButton = document.createElement('button')
  hostButton.textContent = 'Hospedar e Entrar'
  primaryButton(hostButton)
  panel.appendChild(hostButton)

  const divider = document.createElement('div')
  divider.textContent = 'ou entre numa partida existente'
  divider.style.textAlign = 'center'
  divider.style.color = '#78899d'
  divider.style.fontSize = '0.82rem'
  divider.style.margin = '0.5rem 0 0.1rem'
  panel.appendChild(divider)

  const addressInput = document.createElement('input')
  addressInput.type = 'text'
  addressInput.placeholder = 'Endereço do anfitrião (ex: 192.168.1.10:8080)'
  textInput(addressInput)
  panel.appendChild(addressInput)

  const joinButton = document.createElement('button')
  joinButton.textContent = 'Entrar'
  secondaryButton(joinButton)
  panel.appendChild(joinButton)

  const errorMessage = document.createElement('div')
  errorMessage.style.color = '#ff6b6b'
  errorMessage.style.display = 'none'
  errorMessage.style.marginTop = '0.5rem'
  errorMessage.style.textAlign = 'center'
  panel.appendChild(errorMessage)

  const playersTitle = document.createElement('div')
  playersTitle.style.color = '#8fd3ff'
  playersTitle.style.textTransform = 'uppercase'
  playersTitle.style.letterSpacing = '0.1em'
  playersTitle.style.fontSize = '0.78rem'
  playersTitle.style.display = 'none'
  overlay.appendChild(playersTitle)

  const playerList = document.createElement('div')
  playerList.style.display = 'flex'
  playerList.style.flexWrap = 'wrap'
  playerList.style.justifyContent = 'center'
  playerList.style.gap = '0.5rem 1.1rem'
  playerList.style.maxWidth = 'min(34rem, 88vw)'
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

  // Host-only match setting. The server clamps this against the roster size
  // (crew must start strictly ahead of the impostors), so a value here is a
  // request, not a guarantee.
  const settings = document.createElement('div')
  settings.style.display = 'none'
  settings.style.alignItems = 'center'
  settings.style.gap = '0.5rem'
  settings.style.color = '#9fb0c4'
  const settingsLabel = document.createElement('span')
  settingsLabel.textContent = 'Impostores:'
  settings.appendChild(settingsLabel)
  const impostorSelect = document.createElement('select')
  impostorSelect.style.padding = '0.35rem 0.5rem'
  impostorSelect.style.borderRadius = '8px'
  impostorSelect.style.border = '2px solid #3d4a5c'
  impostorSelect.style.background = '#1b2431'
  impostorSelect.style.color = '#eaf2ff'
  impostorSelect.style.fontFamily = 'inherit'
  for (const value of [1, 2]) {
    const option = document.createElement('option')
    option.value = String(value)
    option.textContent = String(value)
    impostorSelect.appendChild(option)
  }
  settings.appendChild(impostorSelect)
  overlay.appendChild(settings)

  const startButton = document.createElement('button')
  startButton.textContent = 'Iniciar Partida'
  primaryButton(startButton)
  startButton.style.minWidth = '12rem'
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
    onStart(Number(impostorSelect.value))
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
      playersTitle.textContent = `Na sala (${players.length})`
      playersTitle.style.display = players.length ? 'block' : 'none'
      for (const player of players) {
        playerList.appendChild(crewmateRow(player.name, player.colorIndex, { size: 30 }))
      }
    },
    setIsHost(isHost) {
      startButton.style.display = isHost ? 'block' : 'none'
      settings.style.display = isHost ? 'flex' : 'none'
    },
    getImpostorCount() {
      return Number(impostorSelect.value)
    },
    setConnected() {
      panel.style.display = 'none'
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
