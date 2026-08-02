import { buildActivity } from './minigames.js'

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
    //
    // The body is delegated to minigames.js by activity type, so the freeze,
    // the pointer-lock release, the busy signal and the wrong-answer lockout
    // are written once here rather than copied into every activity.
    show(activity, finish) {
      onFinish = finish
      overlay.innerHTML = ''
      overlay.style.display = 'flex'

      const title = document.createElement('div')
      title.textContent = activity.title ?? 'Tarefa'
      title.style.color = '#8fd3ff'
      title.style.letterSpacing = '0.1em'
      title.style.textTransform = 'uppercase'
      title.style.fontSize = '0.85rem'
      overlay.appendChild(title)

      const body = document.createElement('div')
      body.style.display = 'flex'
      body.style.flexDirection = 'column'
      body.style.alignItems = 'center'
      body.style.gap = '0.4rem'
      overlay.appendChild(body)

      let settled = false
      buildActivity(body, activity, (result) => {
        // An activity with several clickable parts could call back twice on
        // a fast double click; the shell decides once.
        if (settled) return
        settled = true
        close(result)
      })

      const cancel = document.createElement('button')
      cancel.textContent = 'Sair (Esc)'
      cancel.style.marginTop = '0.6rem'
      cancel.style.background = 'transparent'
      cancel.style.color = '#9fb0c4'
      cancel.style.border = 'none'
      cancel.style.cursor = 'pointer'
      cancel.style.fontFamily = 'inherit'
      cancel.addEventListener('click', () => {
        if (settled) return
        settled = true
        close('cancelled')
      })
      overlay.appendChild(cancel)
    },

    cancel() {
      if (overlay.style.display !== 'none') close('cancelled')
    },
  }
}
