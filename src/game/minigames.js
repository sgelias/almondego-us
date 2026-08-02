import { COLORS } from '../ui/theme.js'

// The per-room activities. Each one renders into a container and calls
// finish('correct' | 'wrong') exactly once.
//
// They share the overlay shell in taskQuiz.js - the freeze, the pointer-lock
// release, the busy signal, the wrong-answer lockout - so a new activity is
// only the body, not another copy of that lifecycle.

function optionButton(text) {
  const button = document.createElement('button')
  button.textContent = text
  button.style.minWidth = 'min(30rem, 80vw)'
  button.style.padding = '0.7rem 1rem'
  button.style.fontSize = '1rem'
  button.style.fontFamily = 'inherit'
  button.style.cursor = 'pointer'
  button.style.border = `2px solid ${COLORS.controlBorder}`
  button.style.borderRadius = '8px'
  button.style.background = COLORS.control
  button.style.color = COLORS.ink
  button.style.textAlign = 'left'
  return button
}

function heading(root, activity) {
  const instruction = document.createElement('div')
  instruction.textContent = activity.instruction ?? ''
  instruction.style.color = COLORS.muted
  instruction.style.marginBottom = '0.4rem'
  root.appendChild(instruction)
}

function feedbackLine(root) {
  const feedback = document.createElement('div')
  feedback.style.minHeight = '1.4rem'
  feedback.style.fontWeight = '700'
  feedback.style.marginTop = '0.5rem'
  root.appendChild(feedback)
  return feedback
}

function settle(feedback, correct, finish) {
  feedback.textContent = correct ? 'Correto!' : 'Ops, não é isso. Tente de novo daqui a pouco.'
  feedback.style.color = correct ? COLORS.good : COLORS.danger
  setTimeout(() => finish(correct ? 'correct' : 'wrong'), correct ? 700 : 1500)
}

// --- multiple choice, used by the reading/route and table activities ---
function buildChoice(root, activity, finish, { extraTop } = {}) {
  heading(root, activity)
  extraTop?.(root)

  const prompt = document.createElement('h2')
  prompt.textContent = activity.prompt
  prompt.style.maxWidth = 'min(38rem, 85vw)'
  prompt.style.textAlign = 'center'
  prompt.style.margin = '0.3rem 0 0.5rem'
  root.appendChild(prompt)

  const feedback = feedbackLine(root)
  const buttons = []
  activity.options.forEach((option, index) => {
    const button = optionButton(option)
    button.addEventListener('click', () => {
      for (const other of buttons) other.disabled = true
      const correct = index === activity.answerIndex
      button.style.borderColor = correct ? COLORS.good : COLORS.danger
      if (!correct) buttons[activity.answerIndex].style.borderColor = COLORS.good
      settle(feedback, correct, finish)
    })
    root.insertBefore(button, feedback)
    buttons.push(button)
  })
}

const BUILDERS = {
  // Elétrica: pick an expression, then pick its result. Two clicks per wire
  // rather than a drag, because dragging is fiddly for a child on a laptop
  // trackpad and adds nothing to the exercise.
  fios(root, activity, finish) {
    heading(root, activity)

    const board = document.createElement('div')
    board.style.display = 'flex'
    board.style.gap = '2.5rem'
    board.style.marginTop = '0.5rem'
    root.appendChild(board)

    const feedback = feedbackLine(root)
    const left = document.createElement('div')
    const right = document.createElement('div')
    for (const column of [left, right]) {
      column.style.display = 'flex'
      column.style.flexDirection = 'column'
      column.style.gap = '0.5rem'
      board.appendChild(column)
    }

    let selected = null
    let solved = 0
    const wireStyle = (button, colour) => {
      button.style.borderColor = colour
    }

    for (const value of activity.results) {
      const button = optionButton(String(value))
      button.style.minWidth = '6rem'
      button.style.textAlign = 'center'
      button.addEventListener('click', () => {
        if (!selected) return
        const correct = selected.pair.result === value
        if (!correct) {
          wireStyle(button, COLORS.danger)
          wireStyle(selected.button, COLORS.danger)
          settle(feedback, false, finish)
          return
        }
        wireStyle(button, COLORS.good)
        wireStyle(selected.button, COLORS.good)
        button.disabled = true
        selected.button.disabled = true
        selected = null
        solved += 1
        if (solved === activity.prompts.length) settle(feedback, true, finish)
      })
      right.appendChild(button)
    }

    for (const pair of activity.prompts) {
      const button = optionButton(pair.prompt)
      button.style.minWidth = '8rem'
      button.style.textAlign = 'center'
      button.addEventListener('click', () => {
        if (selected) wireStyle(selected.button, COLORS.controlBorder)
        selected = { pair, button }
        wireStyle(button, COLORS.accent)
      })
      left.appendChild(button)
    }
  },

  // Reator: tap the values in ascending order.
  ordem(root, activity, finish) {
    heading(root, activity)

    const grid = document.createElement('div')
    grid.style.display = 'flex'
    grid.style.flexWrap = 'wrap'
    grid.style.justifyContent = 'center'
    grid.style.gap = '0.6rem'
    grid.style.maxWidth = 'min(30rem, 85vw)'
    root.appendChild(grid)

    const feedback = feedbackLine(root)
    let next = 0

    for (const value of activity.values) {
      const button = optionButton(String(value))
      button.style.minWidth = '4.5rem'
      button.style.textAlign = 'center'
      button.style.fontSize = '1.2rem'
      button.addEventListener('click', () => {
        if (value !== activity.solution[next]) {
          button.style.borderColor = COLORS.danger
          settle(feedback, false, finish)
          return
        }
        button.style.borderColor = COLORS.good
        button.disabled = true
        next += 1
        if (next === activity.solution.length) settle(feedback, true, finish)
      })
      grid.appendChild(button)
    }
  },

  // Armas: the options drift down the screen and you shoot the right one.
  // Purely presentational over a normal arithmetic question, but the motion
  // is what makes it feel like a room rather than a form.
  asteroides(root, activity, finish) {
    heading(root, activity)

    const prompt = document.createElement('h2')
    prompt.textContent = activity.prompt
    prompt.style.margin = '0.2rem 0 0.6rem'
    root.appendChild(prompt)

    const field = document.createElement('div')
    field.style.position = 'relative'
    field.style.width = 'min(34rem, 88vw)'
    field.style.height = '13rem'
    field.style.overflow = 'hidden'
    root.appendChild(field)

    const feedback = feedbackLine(root)
    const rocks = []

    activity.options.forEach((option, index) => {
      const rock = document.createElement('button')
      rock.textContent = option
      rock.style.position = 'absolute'
      rock.style.left = `${8 + index * 23}%`
      rock.style.width = '4.2rem'
      rock.style.height = '4.2rem'
      rock.style.borderRadius = '50%'
      rock.style.border = '3px solid #6b5a44'
      rock.style.background = 'radial-gradient(circle at 35% 30%, #9c8866, #5d4c3a)'
      rock.style.color = '#fff'
      rock.style.fontWeight = '800'
      rock.style.fontSize = '1.1rem'
      rock.style.cursor = 'crosshair'
      rock.style.fontFamily = 'inherit'
      field.appendChild(rock)

      // Staggered so they do not descend as a wall.
      rock.animate?.(
        [
          { transform: 'translateY(-4rem) rotate(0deg)' },
          { transform: 'translateY(13rem) rotate(180deg)' },
        ],
        { duration: 9000 + index * 1400, iterations: Infinity, delay: index * 700 }
      )

      rock.addEventListener('click', () => {
        for (const other of rocks) other.disabled = true
        const correct = index === activity.answerIndex
        rock.style.borderColor = correct ? COLORS.good : COLORS.danger
        settle(feedback, correct, finish)
      })
      rocks.push(rock)
    })
  },

  // Admin: read the table, then answer.
  tabela(root, activity, finish) {
    buildChoice(root, activity, finish, {
      extraTop(container) {
        const table = document.createElement('table')
        table.style.borderCollapse = 'collapse'
        table.style.margin = '0.2rem 0 0.6rem'
        table.style.color = COLORS.ink
        for (const row of activity.rows) {
          const tr = document.createElement('tr')
          for (const value of [row.room, String(row.count)]) {
            const td = document.createElement('td')
            td.textContent = value
            td.style.border = `1px solid ${COLORS.controlBorder}`
            td.style.padding = '0.35rem 0.9rem'
            tr.appendChild(td)
          }
          table.appendChild(tr)
        }
        container.appendChild(table)
      },
    })
  },

  // Navegação: the reading passage, framed as picking a route.
  rota(root, activity, finish) {
    buildChoice(root, activity, finish, {
      extraTop(container) {
        const passage = document.createElement('p')
        passage.textContent = activity.passage
        passage.style.maxWidth = 'min(38rem, 85vw)'
        passage.style.lineHeight = '1.55'
        passage.style.background = 'rgba(255,255,255,0.06)'
        passage.style.padding = '0.9rem 1.1rem'
        passage.style.borderRadius = '8px'
        passage.style.margin = '0'
        container.appendChild(passage)
      },
    })
  },
}

// Anything without a bespoke builder (plain maths, plain reading) falls back
// to multiple choice, so a new room or question type is never unplayable.
export function buildActivity(root, activity, finish) {
  const builder = BUILDERS[activity.type]
  if (builder) {
    builder(root, activity, finish)
    return
  }
  buildChoice(root, activity, finish, {
    extraTop(container) {
      if (!activity.passage) return
      const passage = document.createElement('p')
      passage.textContent = activity.passage
      passage.style.maxWidth = 'min(38rem, 85vw)'
      passage.style.lineHeight = '1.55'
      passage.style.background = 'rgba(255,255,255,0.06)'
      passage.style.padding = '0.9rem 1.1rem'
      passage.style.borderRadius = '8px'
      container.appendChild(passage)
    },
  })
}
