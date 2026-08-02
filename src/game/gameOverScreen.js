export function showGameOver(winner, impostorName) {
  const overlay = document.createElement('div')
  overlay.style.position = 'fixed'
  overlay.style.inset = '0'
  overlay.style.display = 'flex'
  overlay.style.flexDirection = 'column'
  overlay.style.alignItems = 'center'
  overlay.style.justifyContent = 'center'
  overlay.style.gap = '0.75rem'
  overlay.style.background = 'rgba(0, 0, 0, 0.95)'
  overlay.style.color = '#fff'
  overlay.style.fontFamily = 'sans-serif'
  overlay.style.zIndex = '25'

  const title = document.createElement('h1')
  title.textContent = winner === 'crew' ? 'Tripulantes vencem!' : 'Impostor vence!'
  overlay.appendChild(title)

  const impostorLine = document.createElement('div')
  impostorLine.textContent = `O Impostor era: ${impostorName}`
  overlay.appendChild(impostorLine)

  document.body.appendChild(overlay)
  return overlay
}
