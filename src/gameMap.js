// gameMap.js - Improved dungeon with BSP-style room placement and strategic design

export const mapWidth = 32;
export const mapHeight = 32;

// Tile types:
// 0 = floor (walkable)
// 1 = stone wall (breakable)
// 2 = enemy spawn
// 3 = brick wall (decorative)
// 4 = wood wall (decorative)
// 5 = boss area
// 6 = treasure room
// 7 = locked door/corridor
// 8 = trap/pit (damage)
// 9 = healing shrine

export const worldMap = [
  // Row 0: Border
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  // Row 1: Entrance area - safe zone
  [1,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  // Row 2: Entrance corridor
  [1,0,0,0,0,1,0,0,0,0,0,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  // Row 3: First room - tutorial enemies
  [1,0,0,0,0,1,1,3,3,3,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  // Row 4: 
  [1,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  // Row 5: Choke point 1 - narrow corridor
  [1,0,0,0,0,1,1,1,1,7,7,7,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,1],
  // Row 6: 
  [1,1,3,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1],
  // Row 7: Side room - ambush position
  [1,0,0,0,0,0,0,0,2,0,0,0,0,0,0,0,0,0,2,0,1,0,0,0,0,0,0,0,0,0,0,1],
  // Row 8: 
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,1],
  // Row 9: Main corridor - choice of paths
  [1,1,1,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,1,1],
  // Row 10: Left path - crypt area
  [1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  // Row 11: 
  [1,0,2,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  // Row 12: Crypt room - multiple enemies
  [1,0,0,0,2,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  // Row 13: 
  [1,0,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  // Row 14: Dead end - secret treasure
  [1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  // Row 15: Back to main path
  [1,1,3,1,1,1,1,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,1],
  // Row 16: Central hub - 4-way intersection
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  // Row 17: 
  [1,0,0,2,0,0,0,0,0,0,0,0,0,0,0,5,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  // Row 18: Right path - flooded/wooden area
  [1,0,0,0,0,0,1,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,1,0,0,0,0,0,0,1],
  // Row 19: 
  [1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1],
  // Row 20: 
  [1,0,0,2,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1],
  // Row 21: Swamp room - difficult terrain
  [1,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0,1],
  // Row 22: 
  [1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1],
  // Row 23: Back to hub
  [1,1,1,3,3,3,1,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,1,3,3,3,3,3,3,1],
  // Row 24: North path - boss arena approach
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  // Row 25: 
  [1,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  // Row 26: Guard room
  [1,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  // Row 27: 
  [1,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  // Row 28: Final corridor - tense buildup
  [1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  // Row 29: 
  [1,0,0,2,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  // Row 30: Boss arena - large open space
  [1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,5,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  // Row 31: Border
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
];

// Enemy spawn configuration with strategic placement
export const enemySpawns = [
  // Tutorial area - easy enemies
  { x: 4, y: 4, type: 'runner', tier: 1 },
  
  // Ambush position - medium enemy hiding in side room
  { x: 8, y: 7, type: 'stalker', tier: 2 },
  { x: 18, y: 7, type: 'runner', tier: 2 },
  
  // Crypt area - group encounter
  { x: 4, y: 11, type: 'stalker', tier: 2 },
  { x: 4, y: 13, type: 'runner', tier: 1 },
  
  // Central hub - elite guard
  { x: 3, y: 17, type: 'stalker', tier: 3 },
  
  // Swamp area - scattered enemies
  { x: 3, y: 20, type: 'runner', tier: 2 },
  
  // Pre-boss gauntlet
  { x: 4, y: 25, type: 'stalker', tier: 3 },
  { x: 2, y: 26, type: 'stalker', tier: 3 },
  { x: 3, y: 29, type: 'runner', tier: 2 },
  
  // Boss position (center of final room)
  { x: 15, y: 30, type: 'boss', tier: 5 }
];

// Room definitions for AI pathfinding and encounter design
export const rooms = [
  { name: 'Entrance', x: 1, y: 1, w: 4, h: 3, type: 'safe' },
  { name: 'Tutorial Chamber', x: 6, y: 3, w: 4, h: 4, type: 'combat', difficulty: 1 },
  { name: 'Ambush Corridor', x: 1, y: 6, w: 5, h: 3, type: 'ambush' },
  { name: 'Crypt', x: 1, y: 10, w: 5, h: 5, type: 'combat', difficulty: 2 },
  { name: 'Treasure Nook', x: 1, y: 14, w: 4, h: 2, type: 'treasure' },
  { name: 'Central Hub', x: 1, y: 16, w: 30, h: 2, type: 'hub' },
  { name: 'Swamp', x: 7, y: 18, w: 17, h: 5, type: 'combat', difficulty: 2, hazard: 'slow' },
  { name: 'Guard Post', x: 1, y: 24, w: 6, h: 4, type: 'combat', difficulty: 3 },
  { name: 'Boss Arena', x: 7, y: 28, w: 23, h: 3, type: 'boss', difficulty: 5 }
];

// Choke points for strategic gameplay
export const chokePoints = [
  { x: 9, y: 5, w: 3, h: 1, name: 'Main Gate' },
  { x: 15, y: 5, w: 1, h: 10, name: 'Central Corridor' },
  { x: 25, y: 18, w: 1, h: 5, name: 'Swamp Entrance' }
];

// Get spawn locations from worldMap
export function getSpawnLocations() {
  const spawns = [];
  for (let y = 0; y < mapHeight; y++) {
    for (let x = 0; x < mapWidth; x++) {
      if (worldMap[y][x] === 2) {
        spawns.push({ x, y });
      }
    }
  }
  return spawns;
}

// Check if position is in a room
export function getRoomAt(x, y) {
  return rooms.find(r => 
    x >= r.x && x < r.x + r.w && 
    y >= r.y && y < r.y + r.h
  );
}

// Get difficulty rating for position
export function getDifficultyAt(x, y) {
  const room = getRoomAt(x, y);
  return room?.difficulty || 1;
}
