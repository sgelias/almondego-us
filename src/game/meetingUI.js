import { crewmateSvg } from '../ui/crewmateIcon.js'
import { COLORS, screenBackdrop, sectionLabel, secondaryButton, createCountdownBar } from '../ui/theme.js'

function styleOverlay(el) {
  screenBackdrop(el)
  el.style.zIndex = '15'
  el.style.padding = '2rem 1rem'
  el.style.overflowY = 'auto'
}

// A clickable crewmate portrait. Used for every vote target so the child
// picks a character, not a line of text.
function voteCard(name, colorIndex, onPick) {
  const card = document.createElement('button')
  card.style.display = 'flex'
  card.style.flexDirection = 'column'
  card.style.alignItems = 'center'
  card.style.gap = '0.35rem'
  card.style.padding = '0.7rem 0.6rem'
  card.style.width = '7.5rem'
  card.style.borderRadius = '12px'
  card.style.border = `2px solid ${COLORS.controlBorder}`
  card.style.background = COLORS.control
  card.style.color = COLORS.ink
  card.style.cursor = 'pointer'
  card.style.fontFamily = 'inherit'
  card.style.fontWeight = '600'
  card.addEventListener('mouseenter', () => {
    if (!card.disabled) card.style.borderColor = COLORS.accent
  })
  card.addEventListener('mouseleave', () => {
    if (!card.disabled) card.style.borderColor = COLORS.controlBorder
  })

  card.appendChild(crewmateSvg(colorIndex, 54))
  const label = document.createElement('span')
  label.textContent = name
  label.style.fontSize = '0.9rem'
  card.appendChild(label)

  card.addEventListener('click', () => onPick(card))
  return card
}

function cardGrid() {
  const grid = document.createElement('div')
  grid.style.display = 'flex'
  grid.style.flexWrap = 'wrap'
  grid.style.justifyContent = 'center'
  grid.style.gap = '0.6rem'
  grid.style.maxWidth = 'min(40rem, 92vw)'
  return grid
}

export function createMeetingUI({ onVote }) {
  const overlay = document.createElement('div')
  styleOverlay(overlay)
  overlay.style.display = 'none'
  document.body.appendChild(overlay)

  function reset(labelText) {
    overlay.innerHTML = ''
    overlay.style.display = 'flex'
    const label = document.createElement('div')
    label.textContent = labelText
    sectionLabel(label)
    overlay.appendChild(label)
  }

  return {
    showDiscussion(seconds, livingPlayers = []) {
      reset('Reunião de emergência')

      const title = document.createElement('h1')
      title.textContent = 'Quem é o impostor?'
      title.style.margin = '0.1rem 0 0.2rem'
      title.style.textAlign = 'center'
      overlay.appendChild(title)

      overlay.appendChild(createCountdownBar(seconds, 'A votação começa em'))

      const grid = cardGrid()
      for (const player of livingPlayers) {
        const card = document.createElement('div')
        card.style.display = 'flex'
        card.style.flexDirection = 'column'
        card.style.alignItems = 'center'
        card.style.gap = '0.3rem'
        card.style.width = '6rem'
        card.appendChild(crewmateSvg(player.colorIndex, 46))
        const name = document.createElement('span')
        name.textContent = player.name
        name.style.fontSize = '0.85rem'
        card.appendChild(name)
        grid.appendChild(card)
      }
      overlay.appendChild(grid)
    },

    // canVote is false for dead players. The server already rejects their
    // votes, but without this the UI still handed them working buttons that
    // visibly "accepted" a vote which was then silently dropped - the client
    // lying to its own player (same class of bug as STATE.md L-008).
    showVoting(livingPlayers, seconds, canVote) {
      reset('Votação')

      const title = document.createElement('h1')
      title.textContent = canVote ? 'Em quem você vota?' : 'Votação em andamento'
      title.style.margin = '0.1rem 0 0.2rem'
      title.style.textAlign = 'center'
      overlay.appendChild(title)

      if (!canVote) {
        const notice = document.createElement('div')
        notice.textContent = 'Você está morto e não pode votar.'
        notice.style.color = COLORS.danger
        notice.style.fontWeight = '600'
        overlay.appendChild(notice)
      }

      overlay.appendChild(createCountdownBar(seconds, 'Votação termina em'))

      const grid = cardGrid()
      overlay.appendChild(grid)

      if (!canVote) {
        for (const player of livingPlayers) {
          const card = document.createElement('div')
          card.style.display = 'flex'
          card.style.flexDirection = 'column'
          card.style.alignItems = 'center'
          card.style.gap = '0.3rem'
          card.style.width = '6rem'
          card.style.opacity = '0.5'
          card.appendChild(crewmateSvg(player.colorIndex, 46))
          const name = document.createElement('span')
          name.textContent = player.name
          name.style.fontSize = '0.85rem'
          card.appendChild(name)
          grid.appendChild(card)
        }
        return
      }

      let hasVoted = false
      const cards = []

      function castVote(targetId, chosen) {
        if (hasVoted) return
        hasVoted = true
        for (const card of cards) {
          card.disabled = true
          if (card !== chosen) card.style.opacity = '0.4'
        }
        chosen.style.borderColor = COLORS.good
        onVote(targetId)
      }

      for (const player of livingPlayers) {
        const card = voteCard(player.name, player.colorIndex, (element) => castVote(player.id, element))
        grid.appendChild(card)
        cards.push(card)
      }

      const skip = document.createElement('button')
      skip.textContent = 'Pular voto'
      secondaryButton(skip)
      skip.style.marginTop = '0.7rem'
      skip.addEventListener('click', () => castVote('skip', skip))
      overlay.appendChild(skip)
      cards.push(skip)
    },

    showResult(ejectedName, ejectedColorIndex, wasImpostor) {
      reset('Resultado')

      if (ejectedName) {
        const icon = crewmateSvg(ejectedColorIndex, 96, { dead: true })
        icon.style.margin = '1.2rem 0'
        overlay.appendChild(icon)
      }

      const message = document.createElement('h1')
      message.textContent = ejectedName ? `${ejectedName} foi ejetado(a)` : 'Ninguém foi ejetado'
      message.style.margin = '0.2rem 0'
      message.style.textAlign = 'center'
      overlay.appendChild(message)

      if (ejectedName) {
        const verdict = document.createElement('div')
        verdict.textContent = wasImpostor ? 'Era o impostor!' : 'Não era o impostor…'
        verdict.style.color = wasImpostor ? COLORS.good : COLORS.danger
        verdict.style.fontWeight = '700'
        verdict.style.fontSize = '1.15rem'
        overlay.appendChild(verdict)
      }
    },

    hide() {
      overlay.style.display = 'none'
    },
  }
}
