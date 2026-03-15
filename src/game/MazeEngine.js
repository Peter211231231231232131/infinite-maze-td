import { random, mulberry32 } from '../utils/math';

export const TILE_TYPES = {
  WALL: 'wall',
  FLOOR: 'floor',
  CRYSTAL: 'crystal',
  VOID: 'void'
};

let BASE_SEED = 42;

export const setGlobalSeed = (seed) => {
  BASE_SEED = seed;
};

export const getTileAt = (x, y) => {
  // Check if it's the player's starting center (0, 0)
  if (Math.abs(x) <= 2 && Math.abs(y) <= 2) {
      // Deterministically pick 3-5 spots from the perimeter only
      const rng = mulberry32(BASE_SEED + 777);
      const points = [];
      // Generate all 16 boundary points of the 5x5 safety box
      for (let tx = -2; tx <= 2; tx++) {
          for (let ty = -2; ty <= 2; ty++) {
              if (Math.abs(tx) === 2 || Math.abs(ty) === 2) {
                  points.push({x: tx, y: ty});
              }
          }
      }

      // Shuffle and pick 3-5
      const count = Math.floor(rng() * 3) + 3; // Exactly 3-5
      const chosen = [];
      for (let i = 0; i < count; i++) {
          const idx = Math.floor(rng() * points.length);
          chosen.push(points.splice(idx, 1)[0]);
      }

      if (chosen.some(p => p.x === x && p.y === y)) return TILE_TYPES.CRYSTAL;
      return TILE_TYPES.FLOOR;
  }

  // Scaling Factor: Increase to 4 to make "fat" corridors
  const SCALE = 4;
  const mx = Math.floor(x / SCALE);
  const my = Math.floor(y / SCALE);

  // Maze Logic on scaled coordinates:
  const isCellCenter = (mx % 2 === 0 && my % 2 === 0);
  
  if (isCellCenter) {
    // 16x16 Chunk-based Spawning
    const CHUNK_SIZE = 16;
    const cx = Math.floor(x / CHUNK_SIZE);
    const cy = Math.floor(y / CHUNK_SIZE);
    
    // 25% chance per 16x16 chunk to have an ore site
    if (random(cx, cy, BASE_SEED + 101) < 0.25) {
        // Randomly pick 1 of the 4 maze cells within this chunk to be the site
        const targetCellOffX = Math.floor(random(cx, cy, BASE_SEED + 202) * 2);
        const targetCellOffY = Math.floor(random(cx, cy, BASE_SEED + 303) * 2);
        
        // Relative cell index within chunk for current x,y
        const rCellX = ((mx % 4) + 4) % 4;
        const rCellY = ((my % 4) + 4) % 4;
        
        if (rCellX === targetCellOffX * 2 && rCellY === targetCellOffY * 2) {
            // This is the chosen cell! Now roll for cluster size (1-3)
            const clusterSize = Math.floor(random(cx, cy, BASE_SEED + 404) * 3) + 1;
            
            // Relative tile within the 4x4 cell
            const iX = ((x % 4) + 4) % 4;
            const iY = ((y % 4) + 4) % 4;

            // Clump patterns for 1, 2, or 3 crystals
            if (clusterSize === 1) {
                if (iX === 2 && iY === 2) return TILE_TYPES.CRYSTAL;
            } else if (clusterSize === 2) {
                if ((iX === 1 && iY === 1) || (iX === 2 && iY === 1)) return TILE_TYPES.CRYSTAL;
            } else if (clusterSize === 3) {
                if ((iX === 1 && iY === 1) || (iX === 2 && iY === 1) || (iX === 1 && iY === 2)) return TILE_TYPES.CRYSTAL;
            }
        }
    }
    return TILE_TYPES.FLOOR;
  }

  const isHorizontalPath = (Math.abs(mx) % 2 === 1 && Math.abs(my) % 2 === 0);
  const isVerticalPath = (Math.abs(mx) % 2 === 0 && Math.abs(my) % 2 === 1);

  if (isHorizontalPath) {
    const seedX = Math.min(mx - 1, mx + 1);
    const bridgeRandom = random(seedX, my, BASE_SEED);
    // 70% chance of being a wide floor path
    return bridgeRandom < 0.7 ? TILE_TYPES.FLOOR : TILE_TYPES.WALL;
  }

  if (isVerticalPath) {
    const seedY = Math.min(my - 1, my + 1);
    const bridgeRandom = random(mx, seedY, BASE_SEED + 1);
    return bridgeRandom < 0.7 ? TILE_TYPES.FLOOR : TILE_TYPES.WALL;
  }

  // Junctions/Walls are now solid SCALE x SCALE blocks
  return TILE_TYPES.WALL;
};
