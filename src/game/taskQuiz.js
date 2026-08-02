// The in-match task minigame: a console asks an educational question and
// only marks the task done once the child answers it correctly (AD-008).
//
// A wrong answer costs something (the user asked for this explicitly): the
// console locks for a few seconds and, when it reopens, asks a *different*
// question - so guessing through the four options is slower than working the
// answer out, but nothing is permanently lost, which would be the wrong
// lesson for the age group.
export const WRONG_ANSWER_LOCKOUT_MS = 5000

function styleOverlay(el) {
  el.style.position = 'fixed'
  el.style.inset = '0'
  el.style.display = 'none'
  el.style.flexDirection = 'column'
  el.style.alignItems = 'center'
  el.style.justifyContent = 'center'
  el.style.gap = '0.6rem'
  el.style.background = 'rgba(8, 12, 18, 0.95)'
  el.style.color = '#fff'
  el.style.fontFamily = 'sans-serif'
  el.style.zIndex = '16'
  el.style.padding = '2rem'
}

function styleAnswerButton(button) {
  button.style.minWidth = 'min(30rem, 80vw)'
  button.style.padding = '0.7rem 1rem'
  button.style.fontSize = '1rem'
  button.style.fontFamily = 'inherit'
  button.style.cursor = 'pointer'
  button.style.border = '2px solid #3d4a5c'
  button.style.borderRadius = '8px'
  button.style.background = '#1b2431'
  button.style.color = '#eaf2ff'
  button.style.textAlign = 'left'
}

export function createTaskQuiz() {
  const overlay = document.createElement('div')
  styleOverlay(overlay)
  document.body.appendChild(overlay)

  let onFinish = null

  function close(result) {
    overlay.style.display = 'none'
    overlay.innerHTML = ''
    const callback = onFinish
    onFinish = null
    callback?.(result)
  }

  return {
    isOpen() {
      return overlay.style.display !== 'none'
    },

    // finish(result) is called with 'correct', 'wrong', or 'cancelled'.
    show(question, finish) {
      onFinish = finish
      overlay.innerHTML = ''
      overlay.style.display = 'flex'

      const title = document.createElement('div')
      title.textContent = question.title ?? 'Tarefa'
      title.style.color = '#8fd3ff'
      title.style.letterSpacing = '0.1em'
      title.style.textTransform = 'uppercase'
      title.style.fontSize = '0.85rem'
      overlay.appendChild(title)

      if (question.passage) {
        const passage = document.createElement('p')
        passage.textContent = question.passage
        passage.style.maxWidth = 'min(38rem, 85vw)'
        passage.style.lineHeight = '1.55'
        passage.style.background = 'rgba(255,255,255,0.06)'
        passage.style.padding = '0.9rem 1.1rem'
        passage.style.borderRadius = '8px'
        passage.style.margin = '0'
        overlay.appendChild(passage)
      }

      const prompt = document.createElement('h2')
      prompt.textContent = question.prompt
      prompt.style.maxWidth = 'min(38rem, 85vw)'
      prompt.style.textAlign = 'center'
      prompt.style.margin = '0.3rem 0 0.5rem'
      overlay.appendChild(prompt)

      if (question.hint) {
        const hint = document.createElement('div')
        hint.textContent = question.hint
        hint.style.color = '#b6c6d8'
        hint.style.fontSize = '0.9rem'
        hint.style.maxWidth = 'min(38rem, 85vw)'
        hint.style.textAlign = 'center'
        overlay.appendChild(hint)
      }

      const feedback = document.createElement('div')
      feedback.style.minHeight = '1.4rem'
      feedback.style.fontWeight = '600'

      const buttons = []
      question.options.forEach((option, index) => {
        const button = document.createElement('button')
        button.textContent = option
        styleAnswerButton(button)
        button.addEventListener('click', () => {
          for (const other of buttons) other.disabled = true
          const correct = index === question.answerIndex
          button.style.borderColor = correct ? '#3ddc84' : '#ff6b6b'
          feedback.textContent = correct ? 'Correto!' : 'Ops, não é essa. Tente de novo daqui a pouco.'
          feedback.style.color = correct ? '#3ddc84' : '#ff6b6b'
          if (!correct) {
            buttons[question.answerIndex].style.borderColor = '#3ddc84'
          }
          setTimeout(() => close(correct ? 'correct' : 'wrong'), correct ? 650 : 1600)
        })
        overlay.appendChild(button)
        buttons.push(button)
      })

      overlay.appendChild(feedback)

      const cancel = document.createElement('button')
      cancel.textContent = 'Sair (Esc)'
      cancel.style.marginTop = '0.6rem'
      cancel.style.background = 'transparent'
      cancel.style.color = '#9fb0c4'
      cancel.style.border = 'none'
      cancel.style.cursor = 'pointer'
      cancel.style.fontFamily = 'inherit'
      cancel.addEventListener('click', () => close('cancelled'))
      overlay.appendChild(cancel)
    },

    cancel() {
      if (overlay.style.display !== 'none') close('cancelled')
    },
  }
}
