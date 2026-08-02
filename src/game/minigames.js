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

  // Observatório: an actual clock face. A multiple choice listing times with
  // no clock to read would be a memory question, not a clock-reading one.
  relogio(root, activity, finish) {
    buildChoice(root, activity, finish, {
      extraTop(container) {
        const size = 150
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        svg.setAttribute('viewBox', `0 0 ${size} ${size}`)
        svg.setAttribute('width', String(size))
        svg.setAttribute('height', String(size))

        const circle = document.createElementNS(svg.namespaceURI, 'circle')
        circle.setAttribute('cx', String(size / 2))
        circle.setAttribute('cy', String(size / 2))
        circle.setAttribute('r', String(size / 2 - 6))
        circle.setAttribute('fill', 'rgba(255,255,255,0.08)')
        circle.setAttribute('stroke', COLORS.accent)
        circle.setAttribute('stroke-width', '3')
        svg.appendChild(circle)

        // Hour ticks, and the numbers at 12/3/6/9 as anchors.
        for (let i = 0; i < 12; i += 1) {
          const angle = (i / 12) * Math.PI * 2 - Math.PI / 2
          const inner = i % 3 === 0 ? size / 2 - 20 : size / 2 - 14
          const tick = document.createElementNS(svg.namespaceURI, 'line')
          tick.setAttribute('x1', String(size / 2 + Math.cos(angle) * inner))
          tick.setAttribute('y1', String(size / 2 + Math.sin(angle) * inner))
          tick.setAttribute('x2', String(size / 2 + Math.cos(angle) * (size / 2 - 9)))
          tick.setAttribute('y2', String(size / 2 + Math.sin(angle) * (size / 2 - 9)))
          tick.setAttribute('stroke', COLORS.muted)
          tick.setAttribute('stroke-width', i % 3 === 0 ? '3' : '1.5')
          svg.appendChild(tick)
        }

        const hand = (fraction, length, width, colour) => {
          const angle = fraction * Math.PI * 2 - Math.PI / 2
          const line = document.createElementNS(svg.namespaceURI, 'line')
          line.setAttribute('x1', String(size / 2))
          line.setAttribute('y1', String(size / 2))
          line.setAttribute('x2', String(size / 2 + Math.cos(angle) * length))
          line.setAttribute('y2', String(size / 2 + Math.sin(angle) * length))
          line.setAttribute('stroke', colour)
          line.setAttribute('stroke-width', String(width))
          line.setAttribute('stroke-linecap', 'round')
          svg.appendChild(line)
        }
        // The hour hand moves with the minutes, or half past would read as
        // exactly on the hour and the puzzle would lie.
        hand(((activity.hour % 12) + activity.minute / 60) / 12, size / 2 - 46, 6, COLORS.ink)
        hand(activity.minute / 60, size / 2 - 26, 4, COLORS.accent)

        svg.style.margin = '0.2rem 0 0.4rem'
        container.appendChild(svg)
      },
    })
  },

  // Laboratório: the two pans, drawn. Seeing one side heavier is the whole
  // intuition being taught.
  balanca(root, activity, finish) {
    buildChoice(root, activity, finish, {
      extraTop(container) {
        const scales = document.createElement('div')
        scales.style.display = 'flex'
        scales.style.alignItems = 'flex-end'
        scales.style.justifyContent = 'center'
        scales.style.gap = '1.2rem'
        scales.style.margin = '0.3rem 0 0.5rem'

        const pan = (weight, label, tilt) => {
          const column = document.createElement('div')
          column.style.display = 'flex'
          column.style.flexDirection = 'column'
          column.style.alignItems = 'center'
          column.style.transform = `translateY(${tilt}px)`

          const dish = document.createElement('div')
          dish.textContent = label
          dish.style.minWidth = '5.5rem'
          dish.style.padding = '0.8rem 0.6rem'
          dish.style.textAlign = 'center'
          dish.style.fontSize = '1.3rem'
          dish.style.fontWeight = '800'
          dish.style.borderRadius = '0 0 12px 12px'
          dish.style.border = `2px solid ${COLORS.controlBorder}`
          dish.style.borderTop = 'none'
          dish.style.background = 'rgba(255,255,255,0.08)'
          column.appendChild(dish)
          return column
        }

        // The lighter side sits higher, the way a real balance would.
        scales.appendChild(pan(activity.left, `${activity.left} kg + ?`, activity.left < activity.right ? -14 : 8))
        const pivot = document.createElement('div')
        pivot.textContent = '⚖'
        pivot.style.fontSize = '2rem'
        scales.appendChild(pivot)
        scales.appendChild(pan(activity.right, `${activity.right} kg`, activity.left < activity.right ? 8 : -14))

        container.appendChild(scales)
      },
    })
  },

  // Estufa: the planters, so the fraction is something seen before it is
  // something written.
  fracoes(root, activity, finish) {
    buildChoice(root, activity, finish, {
      extraTop(container) {
        const row = document.createElement('div')
        row.style.display = 'flex'
        row.style.gap = '0.3rem'
        row.style.margin = '0.3rem 0 0.5rem'
        for (let i = 0; i < activity.total; i += 1) {
          const cell = document.createElement('div')
          const watered = i < activity.filled
          cell.textContent = watered ? '🌱' : ''
          cell.style.width = '2.6rem'
          cell.style.height = '2.6rem'
          cell.style.display = 'flex'
          cell.style.alignItems = 'center'
          cell.style.justifyContent = 'center'
          cell.style.fontSize = '1.4rem'
          cell.style.borderRadius = '6px'
          cell.style.border = `2px solid ${watered ? COLORS.good : COLORS.controlBorder}`
          cell.style.background = watered ? 'rgba(61,220,132,0.18)' : 'rgba(255,255,255,0.05)'
          row.appendChild(cell)
        }
        container.appendChild(row)
      },
    })
  },

  // Torre de Rádio: the sequence as pulses, with the gap the child fills.
  sequencia(root, activity, finish) {
    buildChoice(root, activity, finish, {
      extraTop(container) {
        const row = document.createElement('div')
        row.style.display = 'flex'
        row.style.alignItems = 'center'
        row.style.gap = '0.5rem'
        row.style.margin = '0.3rem 0 0.5rem'
        for (const value of activity.sequence) {
          const pulse = document.createElement('div')
          pulse.textContent = String(value)
          pulse.style.minWidth = '3rem'
          pulse.style.padding = '0.5rem 0.4rem'
          pulse.style.textAlign = 'center'
          pulse.style.fontWeight = '700'
          pulse.style.borderRadius = '8px'
          pulse.style.border = `2px solid ${COLORS.controlBorder}`
          pulse.style.background = 'rgba(255,255,255,0.06)'
          row.appendChild(pulse)
        }
        const gap = document.createElement('div')
        gap.textContent = '?'
        gap.style.minWidth = '3rem'
        gap.style.padding = '0.5rem 0.4rem'
        gap.style.textAlign = 'center'
        gap.style.fontWeight = '800'
        gap.style.borderRadius = '8px'
        gap.style.border = `2px dashed ${COLORS.accent}`
        gap.style.color = COLORS.accent
        row.appendChild(gap)
        container.appendChild(row)
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
