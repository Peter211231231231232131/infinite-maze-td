export class SpatialHash {
  constructor(cellSize = 8) {
    this.cellSize = cellSize;
    this.grid = new Map();
  }

  clear() {
    this.grid.clear();
  }

  _key(x, y) {
    const gx = Math.floor(x / this.cellSize);
    const gy = Math.floor(y / this.cellSize);
    return `${gx},${gy}`;
  }

  insert(obj) {
    const key = this._key(obj.x, obj.y);
    if (!this.grid.has(key)) this.grid.set(key, []);
    this.grid.get(key).push(obj);
  }

  query(x, y, radius) {
    const results = [];
    const minX = Math.floor((x - radius) / this.cellSize);
    const maxX = Math.floor((x + radius) / this.cellSize);
    const minY = Math.floor((y - radius) / this.cellSize);
    const maxY = Math.floor((y + radius) / this.cellSize);

    for (let gx = minX; gx <= maxX; gx++) {
      for (let gy = minY; gy <= maxY; gy++) {
        const key = `${gx},${gy}`;
        const cell = this.grid.get(key);
        if (cell) {
          cell.forEach(obj => {
            const dx = obj.x - x;
            const dy = obj.y - y;
            if (dx * dx + dy * dy <= radius * radius) {
              results.push(obj);
            }
          });
        }
      }
    }
    return results;
  }
}

export const spatialHash = new SpatialHash(8);
