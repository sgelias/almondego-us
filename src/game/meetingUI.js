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
  el.style.zIndex = '15'
}

export function createMeetingUI({ onVote }) {
  const overlay = document.createElement('div')
  styleOverlay(overlay)
  overlay.style.display = 'none'
  document.body.appendChild(overlay)

  let countdownTimer = null

  function clearCountdown() {
    if (countdownTimer) {
      clearInterval(countdownTimer)
      countdownTimer = null
    }
  }

  function renderCountdown(label, seconds) {
    const timerLine = document.createElement('div')
    let remaining = seconds
    timerLine.textContent = `${label} (${remaining}s)`
    overlay.appendChild(timerLine)

    clearCountdown()
    countdownTimer = setInterval(() => {
      remaining = Math.max(0, remaining - 1)
      timerLine.textContent = `${label} (${remaining}s)`
      if (remaining === 0) clearCountdown()
    }, 1000)
  }

  return {
    showDiscussion(seconds) {
      overlay.innerHTML = ''
      overlay.style.display = 'flex'

      const title = document.createElement('h1')
      title.textContent = 'Reunião de Emergência'
      overlay.appendChild(title)

      renderCountdown('Discussão', seconds)
    },

    // canVote is false for dead players. The server already rejects their
    // votes, but without this the UI still handed them working buttons that
    // visibly "accepted" a vote which was then silently dropped - the client
    // lying to its own player (same class of bug as STATE.md L-008).
    showVoting(livingPlayers, seconds, canVote) {
      overlay.innerHTML = ''
      overlay.style.display = 'flex'

      const title = document.createElement('h1')
      title.textContent = 'Votação'
      overlay.appendChild(title)

      renderCountdown('Votação termina em', seconds)

      if (!canVote) {
        const notice = document.createElement('div')
        notice.textContent = 'Você está morto e não pode votar.'
        notice.style.color = '#ff6b6b'
        notice.style.marginBottom = '0.5rem'
        overlay.appendChild(notice)

        for (const player of livingPlayers) {
          const row = document.createElement('div')
          row.textContent = player.name
          row.style.opacity = '0.55'
          overlay.appendChild(row)
        }
        return
      }

      let hasVoted = false
      const buttons = []

      function castVote(targetId) {
        if (hasVoted) return
        hasVoted = true
        for (const button of buttons) button.disabled = true
        onVote(targetId)
      }

      for (const player of livingPlayers) {
        const button = document.createElement('button')
        button.textContent = player.name
        button.addEventListener('click', () => castVote(player.id))
        overlay.appendChild(button)
        buttons.push(button)
      }

      const skipButton = document.createElement('button')
      skipButton.textContent = 'Pular'
      skipButton.addEventListener('click', () => castVote('skip'))
      overlay.appendChild(skipButton)
      buttons.push(skipButton)
    },

    showResult(ejectedName, wasImpostor) {
      clearCountdown()
      overlay.innerHTML = ''
      overlay.style.display = 'flex'

      const message = document.createElement('h1')
      message.textContent = ejectedName
        ? `${ejectedName} foi expulso (${wasImpostor ? 'Impostor' : 'não era o Impostor'})`
        : 'Ninguém foi expulso'
      overlay.appendChild(message)
    },

    hide() {
      clearCountdown()
      overlay.style.display = 'none'
    },
  }
}
