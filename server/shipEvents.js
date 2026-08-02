import { MESSAGE_TYPE } from '../shared/protocol.js'
import {
  getEventById,
  getPanel,
  pickEvent,
  ARM_WINDOW_SECONDS,
  FIRST_EVENT_DELAY_SECONDS,
  EVENT_INTERVAL_SECONDS,
  EVENT_RETRY_SECONDS,
} from '../shared/eventPool.js'
import * as gameState from './gameState.js'

// Runs the ship emergencies: schedules them, tracks who has armed which
// panel, and resolves each one as fixed or expired.
//
// It owns no game rules of its own beyond that - healing on a successful
// fix goes through gameState like every other health change, so `alive` and
// the win conditions stay the single source of truth they have been since
// L-009/L-011.
export function createShipEvents({ getMatch, broadcastToAll, onHealAll, onStarted, randomFn = Math.random }) {
  let active = null
  let scheduleTimer = null
  let expiryTimer = null

  function clearTimers() {
    if (scheduleTimer) clearTimeout(scheduleTimer)
    if (expiryTimer) clearTimeout(expiryTimer)
    scheduleTimer = null
    expiryTimer = null
  }

  function isRunning() {
    return active !== null
  }

  function currentVisionRadius() {
    if (!active) return null
    return getEventById(active.eventId)?.visionRadius ?? null
  }

  function finish(fixed) {
    if (!active) return
    const { eventId } = active
    const event = getEventById(eventId)
    active = null
    if (expiryTimer) {
      clearTimeout(expiryTimer)
      expiryTimer = null
    }

    if (fixed && event?.healsOnFix) onHealAll?.()
    broadcastToAll(MESSAGE_TYPE.EVENT_ENDED, { eventId, fixed })
    scheduleNext(EVENT_INTERVAL_SECONDS)
  }

  function start() {
    const match = getMatch()
    // Never interrupt a meeting or a finished match with an alarm - but come
    // back shortly rather than skipping a whole interval, or a single
    // meeting quietly cancels the next few minutes of emergencies.
    if (!match || match.phase !== 'playing' || active) {
      scheduleNext(EVENT_RETRY_SECONDS)
      return
    }

    const eventId = pickEvent(randomFn)
    const event = getEventById(eventId)
    active = { eventId, armedAt: new Map() }

    broadcastToAll(MESSAGE_TYPE.EVENT_STARTED, {
      eventId,
      name: event.name,
      description: event.description,
      durationSeconds: event.durationSeconds,
      panelIds: event.panels.map((panel) => panel.id),
    })

    onStarted?.(eventId)
    expiryTimer = setTimeout(() => finish(false), event.durationSeconds * 1000)
  }

  function scheduleNext(delaySeconds) {
    if (scheduleTimer) clearTimeout(scheduleTimer)
    scheduleTimer = setTimeout(start, delaySeconds * 1000)
  }

  // Arming a panel. Panels in different rooms cannot be pressed on the same
  // tick by two children, so "together" means inside ARM_WINDOW_SECONDS -
  // that is what makes the two-person event hard rather than impossible.
  function armPanel(playerId, panelId) {
    const match = getMatch()
    if (!match || match.phase !== 'playing' || !active) return false
    if (!gameState.isAlive(match, playerId)) return false
    // Impostors would otherwise be able to quietly resolve the blackout they
    // benefit from, or fake being helpful with no cost.
    if (gameState.getRole(match, playerId) !== 'crewmate') return false

    const found = getPanel(panelId)
    if (!found || found.event.id !== active.eventId) return false

    const now = Date.now()
    active.armedAt.set(panelId, now)
    broadcastToAll(MESSAGE_TYPE.EVENT_PANEL, { eventId: active.eventId, panelId, playerId })

    const event = getEventById(active.eventId)
    const allArmed = event.panels.every((panel) => {
      const at = active.armedAt.get(panel.id)
      return at !== undefined && now - at <= ARM_WINDOW_SECONDS * 1000
    })
    if (allArmed) finish(true)
    return true
  }

  // Which panels of the running event still need someone - what a bot (or a
  // guide arrow) should be heading for.
  function pendingPanelIds() {
    if (!active) return []
    const event = getEventById(active.eventId)
    const now = Date.now()
    return event.panels
      .filter((panel) => {
        const at = active.armedAt.get(panel.id)
        return at === undefined || now - at > ARM_WINDOW_SECONDS * 1000
      })
      .map((panel) => panel.id)
  }

  return {
    startScheduling() {
      clearTimers()
      active = null
      scheduleNext(FIRST_EVENT_DELAY_SECONDS)
    },
    stop() {
      clearTimers()
      active = null
    },
    armPanel,
    isRunning,
    currentVisionRadius,
    pendingPanelIds,
    activeEventId: () => active?.eventId ?? null,
    // Ends a running event without a fix, e.g. because a meeting started.
    cancel() {
      if (active) finish(false)
    },
  }
}
