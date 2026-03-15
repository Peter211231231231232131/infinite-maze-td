import { getTileAt, TILE_TYPES } from './MazeEngine';

export class Pathfinder {
  constructor() {
    this.cache = new Map();
    this.maxIterations = 2000; // Increased to handle expanded mazes
  }

  findPath(start, target) {
    const cacheKey = `${start.x},${start.y}->${target.x},${target.y}`;
    if (this.cache.has(cacheKey)) {
      const entry = this.cache.get(cacheKey);
      if (Date.now() - entry.time < 5000) return [...entry.path]; // Cache for 5s
    }

    const openSet = [{ 
      x: start.x, 
      y: start.y, 
      g: 0, 
      f: this.heuristic(start, target),
      parent: null 
    }];
    
    const closedSet = new Set();
    let iterations = 0;

    while (openSet.length > 0 && iterations < this.maxIterations) {
      iterations++;
      
      // Get lowest f score
      let lowestIdx = 0;
      for (let i = 1; i < openSet.length; i++) {
        if (openSet[i].f < openSet[lowestIdx].f) lowestIdx = i;
      }
      const current = openSet.splice(lowestIdx, 1)[0];
      const currentKey = `${current.x},${current.y}`;

      if (current.x === target.x && current.y === target.y) {
        const path = this.reconstruct(current);
        this.cache.set(cacheKey, { path, time: Date.now() });
        return [...path];
      }

      closedSet.add(currentKey);

      const neighbors = [
        { x: current.x + 1, y: current.y },
        { x: current.x - 1, y: current.y },
        { x: current.x, y: current.y + 1 },
        { x: current.x, y: current.y - 1 },
      ];

      for (const next of neighbors) {
        const nextKey = `${next.x},${next.y}`;
        if (closedSet.has(nextKey)) continue;
        if (getTileAt(next.x, next.y) === TILE_TYPES.WALL) continue;

        const g = current.g + 1;
        const h = this.heuristic(next, target);
        const f = g + h;

        const existing = openSet.find(o => o.x === next.x && o.y === next.y);
        if (existing) {
          if (g < existing.g) {
            existing.g = g;
            existing.f = f;
            existing.parent = current;
          }
        } else {
          openSet.push({ ...next, g, f, parent: current });
        }
      }
    }

    return null;
  }

  heuristic(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  reconstruct(node) {
    const path = [];
    let curr = node;
    while (curr) {
      path.push({ x: curr.x, y: curr.y });
      curr = curr.parent;
    }
    return path.reverse();
  }
}

export const pathfinder = new Pathfinder();
