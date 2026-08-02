import { crewmateSvg } from '../ui/crewmateIcon.js'
import { COLORS, screenBackdrop, sectionLabel, primaryButton } from '../ui/theme.js'

// showGameOver returns a handle so main.js can tear the screen down again on
// a restart - previously it just appended an overlay that could never be
// removed, which is fine for a match that ends the session but not for
// "play again".
export function showGameOver(winner, impostorName, impostorColorIndex, { canRestart, onRestart }) {
  const crewWon = winner === 'crew'

  const overlay = document.createElement('div')
  screenBackdrop(overlay)
  overlay.style.zIndex = '25'
  overlay.style.padding = '2rem 1rem'

  const label = document.createElement('div')
  label.textContent = 'Fim de jogo'
  sectionLabel(label)
  overlay.appendChild(label)

  const title = document.createElement('h1')
  title.textContent = crewWon ? 'Tripulantes vencem!' : 'Impostor vence!'
  title.style.margin = '0.2rem 0 0.6rem'
  title.style.fontSize = 'clamp(1.8rem, 6vw, 3rem)'
  title.style.color = crewWon ? COLORS.accent : COLORS.danger
  title.style.textAlign = 'center'
  overlay.appendChild(title)

  const icon = crewmateSvg(impostorColorIndex, 110)
  overlay.appendChild(icon)

  const impostorLine = document.createElement('div')
  impostorLine.textContent = `O impostor era: ${impostorName}`
  impostorLine.style.fontWeight = '700'
  impostorLine.style.fontSize = '1.15rem'
  impostorLine.style.marginTop = '0.6rem'
  overlay.appendChild(impostorLine)

  if (canRestart) {
    const restart = document.createElement('button')
    restart.textContent = 'Jogar novamente'
    primaryButton(restart)
    restart.style.marginTop = '1.4rem'
    restart.style.minWidth = '12rem'
    restart.addEventListener('click', () => {
      restart.disabled = true
      restart.textContent = 'Reiniciando…'
      onRestart()
    })
    overlay.appendChild(restart)
  } else {
    // Only the host can start a match (the server rejects `start` from
    // anyone else), so telling everyone else to wait is more honest than
    // showing them a button that would silently do nothing.
    const waiting = document.createElement('div')
    waiting.textContent = 'Aguardando o anfitrião iniciar uma nova partida…'
    waiting.style.color = COLORS.muted
    waiting.style.marginTop = '1.4rem'
    overlay.appendChild(waiting)
  }

  document.body.appendChild(overlay)
  return {
    remove() {
      overlay.remove()
    },
  }
}
