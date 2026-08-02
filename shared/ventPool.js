export const VENT_LOCATIONS = [
  { id: 'vent-reactor', roomId: 'reactor', offset: [1, 0, 1], group: 'engines' },
  { id: 'vent-upperEngine', roomId: 'upperEngine', offset: [1, 0, 1], group: 'engines' },
  { id: 'vent-lowerEngine', roomId: 'lowerEngine', offset: [1, 0, 1], group: 'engines' },

  { id: 'vent-electrical', roomId: 'electrical', offset: [-1, 0, -1], group: 'medSecurity' },
  { id: 'vent-medbay', roomId: 'medbay', offset: [-1, 0, -1], group: 'medSecurity' },
  { id: 'vent-security', roomId: 'security', offset: [-1, 0, -1], group: 'medSecurity' },

  { id: 'vent-admin', roomId: 'admin', offset: [1, 0, -1], group: 'adminCafeteria' },
  { id: 'vent-cafeteria', roomId: 'cafeteria', offset: [-2, 0, -2], group: 'adminCafeteria' },

  { id: 'vent-navigation', roomId: 'navigation', offset: [1, 0, -1], group: 'navWeaponsShields' },
  { id: 'vent-weapons', roomId: 'weapons', offset: [1, 0, 1], group: 'navWeaponsShields' },
  { id: 'vent-shields', roomId: 'shields', offset: [-1, 0, 1], group: 'navWeaponsShields' },
]

const VENTS_BY_ID = new Map(VENT_LOCATIONS.map((vent) => [vent.id, vent]))
const GROUP_ORDER = new Map()
for (const vent of VENT_LOCATIONS) {
  if (!GROUP_ORDER.has(vent.group)) GROUP_ORDER.set(vent.group, [])
  GROUP_ORDER.get(vent.group).push(vent.id)
}

export function getVentDestination(ventId) {
  const vent = VENTS_BY_ID.get(ventId)
  if (!vent) return null

  const groupIds = GROUP_ORDER.get(vent.group)
  const index = groupIds.indexOf(ventId)
  const nextIndex = (index + 1) % groupIds.length
  return groupIds[nextIndex]
}
