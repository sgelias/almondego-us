import { crewmateSvg } from '../ui/crewmateIcon.js'
import { COLORS, screenBackdrop, sectionLabel, primaryButton } from '../ui/theme.js'

// showGameOver returns a handle so main.js can tear the screen down again on
// a restart - previously it just appended an overlay that could never be
// removed, which is fine for a match that ends the session but not for
// "play again".
export function showGameOver(winner, impostors, { canRestart, onRestart }) {
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
  title.textContent = crewWon ? 'Tripulantes vencem!' : impostors.length > 1 ? 'Impostores vencem!' : 'Impostor vence!'
  title.style.margin = '0.2rem 0 0.6rem'
  title.style.fontSize = 'clamp(1.8rem, 6vw, 3rem)'
  title.style.color = crewWon ? COLORS.accent : COLORS.danger
  title.style.textAlign = 'center'
  overlay.appendChild(title)

  const impostorLine = document.createElement('div')
  impostorLine.textContent = impostors.length > 1 ? 'Os impostores eram:' : 'O impostor era:'
  impostorLine.style.color = COLORS.muted
  impostorLine.style.marginBottom = '0.5rem'
  overlay.appendChild(impostorLine)

  const row = document.createElement('div')
  row.style.display = 'flex'
  row.style.gap = '1.2rem'
  row.style.flexWrap = 'wrap'
  row.style.justifyContent = 'center'
  for (const impostor of impostors) {
    const column = document.createElement('div')
    column.style.display = 'flex'
    column.style.flexDirection = 'column'
    column.style.alignItems = 'center'
    column.style.gap = '0.35rem'
    column.appendChild(crewmateSvg(impostor.colorIndex, 96))
    const name = document.createElement('span')
    name.textContent = impostor.name
    name.style.fontWeight = '700'
    column.appendChild(name)
    row.appendChild(column)
  }
  overlay.appendChild(row)

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
      // If the restart does not land, the button must not stay dead - a
      // permanently disabled "Reiniciando…" is indistinguishable from a
      // broken game. A successful restart removes this whole overlay well
      // before the timer fires.
      setTimeout(() => {
        if (!overlay.isConnected) return
        restart.disabled = false
        restart.textContent = 'Jogar novamente'
      }, 3000)
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
