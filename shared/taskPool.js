// Task locations. The `label` is what the player reads in the HUD, so it
// names the room in Portuguese exactly as the minimap does - a task list
// that says "Electrical" while the map says "Elétrica" makes the child hunt
// for a room that does not appear anywhere.
export const TASK_LOCATIONS = [
  { id: 'wiring-electrical', roomId: 'electrical', offset: [1.5, 0, 1.5], label: 'Consertar a fiação (Elétrica)' },
  { id: 'calibrate-navigation', roomId: 'navigation', offset: [-1.5, 0, 0], label: 'Calibrar a rota (Navegação)' },
  { id: 'inventory-storage', roomId: 'storage', offset: [2, 0, -2], label: 'Esvaziar o lixo (Depósito)' },
  { id: 'swipe-card-admin', roomId: 'admin', offset: [0, 0, 2], label: 'Passar o cartão (Admin)' },
  { id: 'clear-asteroids-weapons', roomId: 'weapons', offset: [-1.5, 0, -1.5], label: 'Destruir asteroides (Armas)' },
]
