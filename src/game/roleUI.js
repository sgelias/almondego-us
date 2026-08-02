const ROLE_REVEAL_DURATION_MS = 3000

function styleFullScreenBanner(el) {
  el.style.position = 'fixed'
  el.style.inset = '0'
  el.style.display = 'none'
  el.style.alignItems = 'center'
  el.style.justifyContent = 'center'
  el.style.fontSize = '2.5rem'
  el.style.fontFamily = 'sans-serif'
  el.style.color = '#fff'
  el.style.background = 'rgba(0, 0, 0, 0.85)'
  el.style.zIndex = '20'
}

// SPEC_DEVIATION: design.md's showRole(role, taskLabels) took a plain label
// array. spec.md's GAME-02 needs each task to show its own completion state,
// which requires looking a task up by id - so this takes an id-keyed object
// instead, and adds markTaskDone(taskId) to flip one entry's checkmark.
export function createRoleUI() {
  const roleBanner = document.createElement('div')
  styleFullScreenBanner(roleBanner)
  document.body.appendChild(roleBanner)

  const hud = document.createElement('div')
  hud.style.position = 'fixed'
  hud.style.top = '1rem'
  hud.style.left = '1rem'
  hud.style.color = '#fff'
  hud.style.fontFamily = 'sans-serif'
  hud.style.background = 'rgba(0, 0, 0, 0.5)'
  hud.style.padding = '0.75rem'
  hud.style.borderRadius = '6px'
  hud.style.display = 'none'
  document.body.appendChild(hud)

  const taskItemsById = new Map()
  let progressLine = null

  return {
    showRole(role, taskLabelsById, color) {
      roleBanner.textContent = role === 'impostor' ? 'Você é o Impostor' : 'Você é um Tripulante'
      roleBanner.style.color = role === 'impostor' ? '#ff5555' : '#8fd3ff'
      roleBanner.style.display = 'flex'
      setTimeout(() => {
        roleBanner.style.display = 'none'
      }, ROLE_REVEAL_DURATION_MS)

      hud.innerHTML = ''
      taskItemsById.clear()

      const title = document.createElement('div')
      title.textContent = role === 'impostor' ? 'Impostor' : 'Tarefas'
      title.style.fontWeight = '600'
      title.style.marginBottom = '0.35rem'
      hud.appendChild(title)

      // First person means you never see your own avatar, so the HUD is the
      // only place you can learn which colour the others see you as.
      if (Number.isInteger(color)) {
        const swatch = document.createElement('div')
        swatch.textContent = '● você'
        swatch.style.color = `#${color.toString(16).padStart(6, '0')}`
        swatch.style.marginBottom = '0.35rem'
        hud.appendChild(swatch)
      }

      if (role !== 'impostor') {
        for (const [taskId, label] of Object.entries(taskLabelsById ?? {})) {
          const item = document.createElement('div')
          item.textContent = `☐ ${label}`
          hud.appendChild(item)
          taskItemsById.set(taskId, { element: item, label })
        }
      }

      progressLine = document.createElement('div')
      hud.appendChild(progressLine)
      hud.style.display = 'block'
    },

    markTaskDone(taskId) {
      const entry = taskItemsById.get(taskId)
      if (entry) entry.element.textContent = `☑ ${entry.label}`
    },

    updateProgress(completed, total) {
      if (progressLine) progressLine.textContent = `${completed} / ${total} tarefas concluídas`
    },

    // Clears the HUD between matches without destroying the elements - the
    // next showRole() rebuilds their contents.
    reset() {
      roleBanner.style.display = 'none'
      hud.style.display = 'none'
      hud.innerHTML = ''
      taskItemsById.clear()
      progressLine = null
    },

    hide() {
      roleBanner.remove()
      hud.remove()
    },
  }
}
