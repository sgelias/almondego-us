const HOLD_DURATION_SECONDS = 2

export function createTaskInteraction(interactSystem, assignedTaskIds, onComplete) {
  const assigned = new Set(assignedTaskIds)
  const completed = new Set()
  let heldTaskId = null
  let holdProgress = 0

  function reset() {
    heldTaskId = null
    holdProgress = 0
  }

  return {
    update(deltaTime, isInteractKeyDown) {
      const target = interactSystem.getTarget()
      const taskId = target?.userData?.kind === 'task' ? target.userData.taskId : null
      const eligible = taskId && assigned.has(taskId) && !completed.has(taskId)

      if (!isInteractKeyDown || !eligible) {
        reset()
        return
      }

      if (heldTaskId !== taskId) {
        heldTaskId = taskId
        holdProgress = 0
      }

      holdProgress += deltaTime
      if (holdProgress >= HOLD_DURATION_SECONDS) {
        completed.add(taskId)
        reset()
        onComplete(taskId)
      }
    },
  }
}
