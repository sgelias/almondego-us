// One bot's private memory and decision-making.
//
// HARD RULE (bot-players spec.md P3): this module must never be given the
// match state. It receives only what its bot could plausibly have witnessed
// plus the public living-player roster. There is deliberately no parameter
// anywhere in this file through which `match.impostorId` could arrive - if a
// future change needs "who is really the impostor" here, that change is
// wrong: bots that read the answer key win every meeting and the game stops
// being a game.

// How long after seeing a kill a bot waits before running to report it, so
// it doesn't call a meeting on the exact frame the kill lands.
const REPORT_REACTION_MS = 2000
// A death nobody witnessed is still public knowledge (the server broadcasts
// playerDied to everyone), which stands in for "you notice they're gone".
// Bots take noticeably longer to act on that than on a murder they saw, and
// each bot jitters its own delay so they don't all lunge for the button on
// the same tick.
const DEATH_DISCOVERY_MS = 12000
const DEATH_DISCOVERY_JITTER_MS = 10000
// Co-location memory older than this is too stale to implicate anyone.
const COLOCATION_MEMORY_MS = 30000
// How often a bot with no evidence at all skips rather than accusing at
// random. Some random accusation keeps meetings alive; always-accusing would
// make ejections pure noise.
const BLIND_SKIP_CHANCE = 0.5

export function createBotBrain(botId, randomFn = Math.random) {
  const witnessedKills = []
  const witnessedVents = []
  // playerId -> { roomId, at, others: [playerId] } for the last moment this
  // bot saw that player, and who was with them.
  const lastSeenCompanions = new Map()
  const knownDeaths = new Set()
  // victimId -> the earliest timestamp at which this bot would act on that
  // death by calling a meeting. Cleared when a meeting actually happens, so
  // the same death is never re-reported.
  const pendingReports = new Map()

  function noteNearbyPlayers(playerIds, roomId, now) {
    const observed = playerIds.filter((id) => id !== botId)
    for (const id of observed) {
      lastSeenCompanions.set(id, {
        roomId,
        at: now,
        others: observed.filter((other) => other !== id),
      })
    }
  }

  function noteWitnessedKill(killerId, victimId, roomId, now) {
    if (killerId === botId) return
    witnessedKills.push({ killerId, victimId, roomId, at: now })
    knownDeaths.add(victimId)
    // Seeing it happen overrides the slower "noticed they're missing" timer.
    pendingReports.set(victimId, now + REPORT_REACTION_MS)
  }

  function noteWitnessedVent(playerId, roomId, now) {
    if (playerId === botId) return
    witnessedVents.push({ playerId, roomId, at: now })
  }

  function noteDeath(victimId, now = 0) {
    knownDeaths.add(victimId)
    if (pendingReports.has(victimId)) return
    pendingReports.set(victimId, now + DEATH_DISCOVERY_MS + randomFn() * DEATH_DISCOVERY_JITTER_MS)
  }

  function shouldCallMeeting(now) {
    for (const reportAt of pendingReports.values()) {
      if (now >= reportAt) return true
    }
    return false
  }

  // BOT-11's priority order, resolved entirely from this bot's own log:
  //   (a) someone it saw kill      -> strongest possible evidence
  //   (b) someone it saw vent      -> only impostors can vent
  //   (c) the last player it saw alone with someone now dead
  //   (d) nothing witnessed        -> skip, or accuse at random
  function decideVote(livingPlayerIds, randomFn, now = 0) {
    const candidates = livingPlayerIds.filter((id) => id !== botId)
    if (candidates.length === 0) return 'skip'
    const isLiving = (id) => candidates.includes(id)

    const seenKilling = witnessedKills.map((kill) => kill.killerId).find(isLiving)
    if (seenKilling) return seenKilling

    const seenVenting = witnessedVents.map((vent) => vent.playerId).find(isLiving)
    if (seenVenting) return seenVenting

    for (const victimId of knownDeaths) {
      const sighting = lastSeenCompanions.get(victimId)
      if (!sighting) continue
      if (now - sighting.at > COLOCATION_MEMORY_MS) continue
      const suspects = sighting.others.filter(isLiving)
      if (suspects.length === 1) return suspects[0]
    }

    if (randomFn() < BLIND_SKIP_CHANCE) return 'skip'
    return candidates[Math.floor(randomFn() * candidates.length)]
  }

  function clearAfterMeeting() {
    // Hard evidence (a kill or a vent this bot personally saw) survives a
    // meeting - a player does not forget seeing a murder. Co-location memory
    // is cleared because the "who was with whom" picture resets afterwards,
    // and pending reports are cleared so a death already discussed is never
    // dragged to a second meeting.
    pendingReports.clear()
    lastSeenCompanions.clear()
  }

  return {
    botId,
    noteNearbyPlayers,
    noteWitnessedKill,
    noteWitnessedVent,
    noteDeath,
    shouldCallMeeting,
    decideVote,
    clearAfterMeeting,
    // Test/inspection only - not part of the decision path.
    get witnessedKillCount() {
      return witnessedKills.length
    },
  }
}
