import { useEffect, useRef, useState, useCallback } from 'react';
import { getTileAt, TILE_TYPES } from '../game/MazeEngine';

const TILE_SIZE = 40;

const COLORS = {
  [TILE_TYPES.WALL]: '#101025',
  [TILE_TYPES.FLOOR]: '#050505',
  [TILE_TYPES.CRYSTAL]: '#00f2fe',
  CORE: '#fe00f2',
  TOWER: '#f2fe00',
  BEAM: '#00ccff',
  BLAST: '#ff6600',
  SHOCK: '#cc00ff',
  EXPANDER: '#ffffff',
  FACTORY: '#ff9900',
  SUPPLY: '#00ccff',
  DRILL: '#00fe4f',
  ENEMY_NORMAL: '#ff4d4d',
  ENEMY_FAST: '#ffff00',
  ENEMY_TANK: '#ff00ff',
  FOG: '#000',
  PROJECTILE_TOWER: '#fff',
  PROJECTILE_BEAM: '#00f2fe',
  PROJECTILE_BLAST: '#ff9900',
  PROJECTILE_SHOCK: '#cc00ff',
  SELECTION: 'rgba(0, 242, 254, 0.6)',
  GRID: 'rgba(255, 255, 255, 0.05)'
};

const SPRITES = {
  core: new Image(),
  tower: new Image(),
  drill: new Image(),
  beam: new Image(),
  blast: new Image(),
  blast: new Image(),
  zombie: new Image(),
  crystal: new Image(),
  base: new Image(),
  head: new Image(),
  supply: new Image(),
  factory: new Image()
};
SPRITES.core.src = '/assets/core.png';
SPRITES.tower.src = '/assets/tower.png';
SPRITES.drill.src = '/assets/drill.png';
SPRITES.beam.src = '/assets/beam.png';
SPRITES.blast.src = '/assets/blast.png';
SPRITES.zombie.src = '/assets/zombie_walk.png';
SPRITES.crystal.src = '/assets/crystal_pure.png';
SPRITES.base.src = '/assets/base.png';
SPRITES.head.src = '/assets/head.png';
SPRITES.supply.src = '/assets/refiller.png';
SPRITES.factory.src = '/assets/factory_sheet.png';

const GameCanvas = ({ placements, enemies, projectiles, particles, floatingTexts, camera, setCamera, onPlace, buildMode, selectedId, towerTypes }) => {
  const canvasRef = useRef(null);
  const [hoveredId, setHoveredId] = useState(null);
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const [mouseGridPos, setMouseGridPos] = useState({ x: 0, y: 0 });
  const keys = useRef(new Set());

  // Handle Keyboard Controls
  useEffect(() => {
    const handleKeyDown = (e) => keys.current.add(e.key.toLowerCase());
    const handleKeyUp = (e) => keys.current.delete(e.key.toLowerCase());
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    const kbInterval = setInterval(() => {
      setCamera(prev => {
        let { x, y, zoom } = prev;
        const speed = 0.5 / zoom;
        if (keys.current.has('w')) y -= speed;
        if (keys.current.has('s')) y += speed;
        if (keys.current.has('a')) x -= speed;
        if (keys.current.has('d')) x += speed;
        if (keys.current.has('q')) zoom = Math.min(2, zoom * 1.05);
        if (keys.current.has('e')) zoom = Math.max(0.2, zoom * 0.95);
        
        if (x === prev.x && y === prev.y && zoom === prev.zoom) return prev;
        return { x, y, zoom };
      });
    }, 16);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      clearInterval(kbInterval);
    };
  }, [setCamera]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;

    ctx.fillStyle = COLORS.FOG;
    ctx.fillRect(0, 0, width, height);

    const scaledSize = TILE_SIZE * camera.zoom;
    const startX = Math.floor((-width / 2 / scaledSize) + camera.x);
    const endX = Math.ceil((width / 2 / scaledSize) + camera.x);
    const startY = Math.floor((-height / 2 / scaledSize) + camera.y);
    const endY = Math.ceil((height / 2 / scaledSize) + camera.y);

    // 1. Optimized Visibility & Maze Rendering
    // We only need to check which towers can see each tile once
    const visiblePlacements = placements.filter(p => {
        const px = (p.x - camera.x) * scaledSize + width/2;
        const py = (p.y - camera.y) * scaledSize + height/2;
        const margin = p.vision * scaledSize + scaledSize;
        return px > -margin && px < width + margin && py > -margin && py < height + margin;
    });

    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        let isVisible = false;
        // Optimization: Use a simpler distance check against visible placements only
        for (let i = 0; i < visiblePlacements.length; i++) {
          const p = visiblePlacements[i];
          const dx = p.x - x;
          const dy = p.y - y;
          if (dx*dx + dy*dy <= p.vision * p.vision) {
            isVisible = true;
            break;
          }
        }

        if (!isVisible) continue;

        const tileType = getTileAt(x, y);
        const screenX = (x - camera.x) * scaledSize + width / 2;
        const screenY = (y - camera.y) * scaledSize + height / 2;

        if (tileType === TILE_TYPES.WALL) {
          ctx.fillStyle = '#1a1a3e';
          ctx.fillRect(screenX, screenY, scaledSize, scaledSize);
          ctx.strokeStyle = '#2a5a8e';
          ctx.lineWidth = 1;
          ctx.strokeRect(screenX, screenY, scaledSize, scaledSize);
          
          // Detail: Dark industrial corner
          ctx.fillStyle = '#050515';
          ctx.fillRect(screenX + scaledSize * 0.8, screenY, scaledSize * 0.2, scaledSize);
          ctx.fillRect(screenX, screenY + scaledSize * 0.8, scaledSize, scaledSize * 0.2);
        } else {
          ctx.strokeStyle = COLORS.GRID;
          ctx.lineWidth = 0.5;
          ctx.strokeRect(screenX, screenY, scaledSize, scaledSize);
          
          if (tileType === TILE_TYPES.CRYSTAL) {
            const img = SPRITES.crystal;
            if (img && img.complete && img.naturalWidth > 0) {
              const bob = Math.sin(Date.now() / 500 + x * 10 + y * 10) * 0.05 * scaledSize;
              ctx.drawImage(img, screenX - scaledSize*0.1, screenY - scaledSize*0.1 + bob, scaledSize*1.2, scaledSize*1.2);
            } else {
              ctx.fillStyle = COLORS[TILE_TYPES.CRYSTAL];
              ctx.fillRect(screenX + scaledSize*0.25, screenY + scaledSize*0.25, scaledSize*0.5, scaledSize*0.5);
            }
          }
        }
      }
    }

    // 2. Projectiles (Culling included)
    projectiles.forEach(p => {
      const sx = (p.startX - camera.x) * scaledSize + width / 2;
      const sy = (p.startY - camera.y) * scaledSize + height / 2;
      const ex = (p.endX - camera.x) * scaledSize + width / 2;
      const ey = (p.endY - camera.y) * scaledSize + height / 2;

      // Culling: If neither start nor end is on screen, skip
      if ((sx < 0 && ex < 0) || (sx > width && ex > width) || (sy < 0 && ey < 0) || (sy > height && ey > height)) return;

      const progress = (Date.now() - p.startTime) / p.duration;
      const curX = sx + (ex - sx) * progress;
      const curY = sy + (ey - sy) * progress;

      if (p.type === 'beam') {
          ctx.strokeStyle = COLORS.PROJECTILE_BEAM;
          ctx.lineWidth = 4 * camera.zoom;
          ctx.shadowBlur = 10 * camera.zoom;
          ctx.shadowColor = COLORS.PROJECTILE_BEAM;
          ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
          ctx.shadowBlur = 0;
      } else if (p.type === 'blast') {
          ctx.fillStyle = COLORS.PROJECTILE_BLAST;
          ctx.beginPath();
          ctx.arc(curX, curY, (5 + progress * 15) * camera.zoom, 0, Math.PI * 2);
          ctx.fill();
      } else if (p.type === 'shock') {
          ctx.strokeStyle = COLORS.PROJECTILE_SHOCK;
          ctx.lineWidth = 2 * camera.zoom;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          // Jagged line
          for(let i=1; i<4; i++) {
              const tx = sx + (curX - sx) * (i/4) + (Math.random()-0.5)*10;
              const ty = sy + (curY - sy) * (i/4) + (Math.random()-0.5)*10;
              ctx.lineTo(tx, ty);
          }
          ctx.lineTo(curX, curY);
          ctx.stroke();
      } else {
          ctx.strokeStyle = COLORS.PROJECTILE_TOWER;
          ctx.lineWidth = 2 * camera.zoom;
          ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(curX, curY); ctx.stroke();
          ctx.fillStyle = COLORS.PROJECTILE_TOWER;
          ctx.beginPath(); ctx.arc(curX, curY, 3 * camera.zoom, 0, Math.PI * 2); ctx.fill();
      }
    });

    // 3. Particles (Culling included)
    particles.forEach(p => {
        const screenX = (p.x - camera.x) * scaledSize + width / 2;
        const screenY = (p.y - camera.y) * scaledSize + height / 2;
        if (screenX < -10 || screenX > width + 10 || screenY < -10 || screenY > height + 10) return;
        
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(screenX, screenY, 5 * camera.zoom, 5 * camera.zoom);
    });
    ctx.globalAlpha = 1.0;

    // 4. Floating Text
    floatingTexts.forEach(t => {
        const screenX = (t.x - camera.x) * scaledSize + width / 2;
        const screenY = (t.y - camera.y) * scaledSize + height / 2;
        ctx.globalAlpha = t.life;
        ctx.fillStyle = t.color;
        ctx.font = `bold ${18 * camera.zoom}px Outfit`;
        ctx.textAlign = 'center';
        ctx.fillText(t.text, screenX + scaledSize/2, screenY);
    });
    ctx.globalAlpha = 1.0;

    // 4.5 Supply Lines
    ctx.save();
    placements.forEach(s => {
        if (s.type === 'supply') {
            const sx = (s.x - camera.x) * scaledSize + width / 2 + scaledSize / 2;
            const sy = (s.y - camera.y) * scaledSize + height / 2 + scaledSize / 2;
            
            placements.forEach(p => {
                const isBulletRelated = ['tower', 'factory', 'beam', 'blast', 'shock'].includes(p.type);
                if (isBulletRelated) {
                    const dx = p.x - s.x;
                    const dy = p.y - s.y;
                    const distSq = dx * dx + dy * dy;
                    
                    if (distSq <= s.range * s.range) {
                        const px = (p.x - camera.x) * scaledSize + width / 2 + (p.size || 1) * scaledSize / 2;
                        const py = (p.y - camera.y) * scaledSize + height / 2 + (p.size || 1) * scaledSize / 2;
                        
                        const pulse = (Math.sin(Date.now() / 200) + 1) / 2;
                        ctx.strokeStyle = `rgba(0, 242, 255, ${0.4 + pulse * 0.4})`;
                        ctx.lineWidth = 3 * camera.zoom;
                        // Solid line instead of dotted
                        ctx.shadowBlur = 10 * camera.zoom;
                        ctx.shadowColor = '#00ccff';
                        ctx.beginPath();
                        ctx.moveTo(sx, sy);
                        ctx.lineTo(px, py);
                        ctx.stroke();
                        ctx.shadowBlur = 0;
                    }
                }
            });
        }
    });
    ctx.restore();

    // 5. Placements (Culling included)
    placements.forEach(p => {
      const screenX = (p.x - camera.x) * scaledSize + width / 2;
      const screenY = (p.y - camera.y) * scaledSize + height / 2;
      const pSize = (p.size || 1) * scaledSize;

      // Culling
      if (screenX < -pSize || screenX > width || screenY < -pSize || screenY > height) return;

      if (p.id === selectedId || p.id === hoveredId) {
          ctx.strokeStyle = COLORS.SELECTION;
          ctx.lineWidth = 3;
          ctx.strokeRect(screenX - 2, screenY - 2, pSize + 4, pSize + 4);
          
          if (p.range > 0) {
              ctx.strokeStyle = 'rgba(242, 254, 0, 0.4)';
              ctx.beginPath();
              ctx.arc(screenX + pSize/2, screenY + pSize/2, p.range * scaledSize, 0, Math.PI * 2);
              ctx.stroke();
              ctx.fillStyle = 'rgba(242, 254, 0, 0.05)';
              ctx.fill();
          }
      }

      ctx.shadowBlur = 0;
      ctx.shadowBlur = 0;
      
      if (p.type === 'tower') {
          // 1. Draw Static Base
          if (SPRITES.base.complete && SPRITES.base.naturalWidth > 0) {
              ctx.drawImage(SPRITES.base, screenX, screenY, pSize, pSize);
          }
          // 2. Draw Dynamic Rotating Head
          if (SPRITES.head.complete && SPRITES.head.naturalWidth > 0) {
              ctx.save();
              ctx.translate(screenX + pSize/2, screenY + pSize/2);
              // Default aim UP (-PI/2), if tracking, point the head (+PI/2 to align asset's 12-o-clock barrel)
              const aimAngle = p.angle !== undefined ? p.angle : -Math.PI/2;
              ctx.rotate(aimAngle + Math.PI/2);
              ctx.drawImage(SPRITES.head, -pSize/2, -pSize/2, pSize, pSize);
              ctx.restore();
          }
      } else {
        // Special Animated / Overridden Types
        if (p.type === 'factory') {
            if (SPRITES.factory.complete && SPRITES.factory.naturalWidth > 0) {
                const frameCount = 41;
                const frame = Math.floor(Date.now() / 60) % frameCount;
                const cols = 7;
                const col = frame % cols;
                const row = Math.floor(frame / cols);
                ctx.drawImage(SPRITES.factory, col * 640, row * 640, 640, 640, screenX, screenY, pSize, pSize);
            } else {
                ctx.fillStyle = COLORS.FACTORY;
                ctx.fillRect(screenX + pSize*0.15, screenY + pSize*0.15, pSize*0.7, pSize*0.7);
                ctx.strokeStyle = '#ff9900';
                ctx.lineWidth = 2;
                ctx.strokeRect(screenX + pSize*0.25, screenY + pSize*0.25, pSize*0.5, pSize*0.5);
            }
        } else if (p.type === 'supply') {
            if (SPRITES.supply.complete && SPRITES.supply.naturalWidth > 0) {
                ctx.drawImage(SPRITES.supply, screenX, screenY, pSize, pSize);
            } else {
                ctx.fillStyle = COLORS.SUPPLY;
                ctx.beginPath();
                ctx.arc(screenX + pSize/2, screenY + pSize/2, pSize*0.4, 0, Math.PI * 2);
                ctx.fill();
                const pulse = (Math.sin(Date.now() / 300) + 1) / 2;
                ctx.strokeStyle = `rgba(0, 204, 255, ${pulse})`;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(screenX + pSize/2, screenY + pSize/2, pSize*(0.4 + pulse*0.2), 0, Math.PI * 2);
                ctx.stroke();
            }
        } else if (p.type === 'expander') {
            // Draw a radar-like diamond
            ctx.fillStyle = COLORS.EXPANDER;
            ctx.beginPath();
            ctx.moveTo(screenX + pSize/2, screenY);
            ctx.lineTo(screenX + pSize, screenY + pSize/2);
            ctx.lineTo(screenX + pSize/2, screenY + pSize);
            ctx.lineTo(screenX, screenY + pSize/2);
            ctx.closePath();
            ctx.fill();
            
            const pulse = (Math.sin(Date.now() / 200) + 1) / 2;
            ctx.strokeStyle = `rgba(255, 255, 255, ${pulse})`;
            ctx.lineWidth = 2;
            ctx.stroke();
        } else {
            // Generic Sprite Loader
            const img = SPRITES[p.type];
            if (img && img.complete && img.naturalWidth > 0) {
                ctx.drawImage(img, screenX, screenY, pSize, pSize);
            } else {
                ctx.fillStyle = COLORS[p.type.toUpperCase()] || '#555';
                ctx.fillRect(screenX + pSize*0.1, screenY + pSize*0.1, pSize*0.8, pSize*0.8);
            }
        }
      }

      if (p.outOfAmmo) {
          const blink = Math.floor(Date.now() / 250) % 2 === 0;
          if (blink) {
              ctx.fillStyle = '#ff0000';
              ctx.font = `bold ${14 * camera.zoom}px Outfit`;
              ctx.textAlign = 'center';
              ctx.fillText('NO AMMO/SUPPLY', screenX + pSize/2, screenY - 5);
          }
      }

      if (p.level > 1) {
          ctx.fillStyle = '#fff';
          ctx.font = `bold ${12 * camera.zoom}px Outfit`;
          ctx.textAlign = 'right';
          ctx.fillText(`L${p.level}`, screenX + pSize - 2, screenY + pSize - 2);
      }

      if (p.health < p.maxHealth) {
        ctx.fillStyle = '#333';
        ctx.fillRect(screenX, screenY - 5, pSize, 4);
        ctx.fillStyle = '#00fe4f';
        ctx.fillRect(screenX, screenY - 5, pSize * (p.health / p.maxHealth), 4);
      }
    });

    // 6. Enemies (Stacking & Culling Optimization)
    const enemyTileCounts = {};
    enemies.forEach(e => {
      // 6.1 Frustum Culling
      const screenX = (e.x - camera.x) * scaledSize + width / 2;
      const screenY = (e.y - camera.y) * scaledSize + height / 2;
      if (screenX < -scaledSize || screenX > width + scaledSize || screenY < -scaledSize || screenY > height + scaledSize) return;

      // 6.2 Stacking Optimization: Limit enemies drawn per tile grid
      const gridKey = `${Math.floor(e.x)},${Math.floor(e.y)}`;
      enemyTileCounts[gridKey] = (enemyTileCounts[gridKey] || 0) + 1;
      if (enemyTileCounts[gridKey] > 3) return; // Only draw up to 3 enemies per tile

      let isVisible = false;
      // Optimization: Only check against visible placements
      for (let i = 0; i < visiblePlacements.length; i++) {
        const p = visiblePlacements[i];
        const dx = p.x - e.x;
        const dy = p.y - e.y;
        if (dx*dx + dy*dy <= p.vision * p.vision) {
          isVisible = true;
          break;
        }
      }
      if (!isVisible) return;
      
      const img = SPRITES.zombie;
      
      if (img && img.complete && img.naturalWidth > 0) {
          const cols = 8;
          const rows = 4;
          const frameWidth = img.naturalWidth / cols;
          const frameHeight = img.naturalHeight / rows;
          
          let rowIndex = 0; // Default Down
          if (e.path && e.path.length > 0) {
              const target = e.path[0];
              const dx = target.x - e.x;
              const dy = target.y - e.y;
              if (Math.abs(dx) > Math.abs(dy)) {
                  rowIndex = dx > 0 ? 3 : 2; // Right(3), Left(2)
              } else {
                  rowIndex = dy > 0 ? 0 : 1; // Down(0), Up(1)
              }
          }

          const time = Date.now();
          const speedFactor = e.type === 'fast' ? 1.8 : (e.type === 'tank' ? 0.7 : 1.2);
          
          // Cycle through 0-3 columns for the walk animation based on speed
          const colIndex = Math.floor((time / (150 / speedFactor)) + e.id * 10) % cols;
          
          const drawSize = scaledSize * (e.type === 'tank' ? 1.6 : (e.type === 'fast' ? 1.0 : 1.2));
          
          ctx.save();
          ctx.translate(screenX + scaledSize/2, screenY + scaledSize/2);
          
          // Draw simple drop shadow
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.beginPath();
          ctx.ellipse(0, drawSize/2.5, drawSize/3, drawSize/6, 0, 0, Math.PI * 2);
          ctx.fill();

          // Build-in optimized shadow (simple circle is faster than filter)
          if (e.type === 'tank') {
              ctx.globalAlpha = 0.8; 
          } else if (e.type === 'fast') {
              ctx.globalAlpha = 0.6;
          }

          ctx.drawImage(
              img,
              colIndex * frameWidth, rowIndex * frameHeight, frameWidth, frameHeight,
              -drawSize/2, -drawSize/2, 
              drawSize, drawSize
          );
          ctx.restore();
      } else {
          // Fallback
          ctx.fillStyle = e.color || '#ff4d4d';
          const rad = e.type === 'tank' ? 0.45 : (e.type === 'fast' ? 0.2 : 0.3);
          ctx.beginPath();
          ctx.arc(screenX + scaledSize/2, screenY + scaledSize/2, scaledSize * rad, 0, Math.PI * 2);
          ctx.fill();
      }

      if (e.health < e.maxHealth) {
        ctx.fillStyle = '#333';
        ctx.fillRect(screenX + scaledSize*0.1, screenY - 8, scaledSize*0.8, 3);
        ctx.fillStyle = e.color || '#ff4d4d';
        ctx.fillRect(screenX + scaledSize*0.1, screenY - 8, (scaledSize*0.8) * (e.health / e.maxHealth), 3);
      }
    });

    // 5.5 Render Build Preview
    if (buildMode) {
        const x = mouseGridPos.x;
        const y = mouseGridPos.y;
        const spec = towerTypes[buildMode.toLowerCase()];
        const size = spec?.size || 1;
        const screenX = (x - camera.x) * scaledSize + width / 2;
        const screenY = (y - camera.y) * scaledSize + height / 2;
        const pSize = size * scaledSize;

        let canPlace = true;
        // Check footprint validity
        for (let dy = 0; dy < size; dy++) {
            for (let dx = 0; dx < size; dx++) {
                const tx = x + dx;
                const ty = y + dy;
                const tile = getTileAt(tx, ty);
                if (tile === TILE_TYPES.WALL) canPlace = false;
                if (buildMode === 'drill' && tile !== TILE_TYPES.CRYSTAL) canPlace = false;
                if (placements.some(p => {
                    const ps = p.size || 1;
                    return tx >= p.x && tx < p.x+ps && ty >= p.y && ty < p.y+ps;
                })) canPlace = false;
            }
        }

        ctx.globalAlpha = 0.5;
        ctx.fillStyle = canPlace ? 'rgba(0, 254, 79, 0.3)' : 'rgba(255, 77, 77, 0.3)';
        ctx.fillRect(screenX, screenY, pSize, pSize);
        ctx.strokeStyle = canPlace ? '#00fe4f' : '#ff4d4d';
        ctx.lineWidth = 2;
        ctx.strokeRect(screenX, screenY, pSize, pSize);
        
        if (spec?.range > 0) {
            ctx.beginPath();
            ctx.arc(screenX + pSize/2, screenY + pSize/2, spec.range * scaledSize, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.globalAlpha = 1.0;
    }

  }, [camera, placements, enemies, projectiles, particles, floatingTexts, selectedId, hoveredId, buildMode, mouseGridPos, towerTypes]);

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    let frame;
    const loop = () => {
      render();
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [render]);

  const handleMouseDown = (e) => {
    isDragging.current = true;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const scaledSize = TILE_SIZE * camera.zoom;
    const worldX = Math.floor((mx - rect.width / 2) / scaledSize + camera.x);
    const worldY = Math.floor((my - rect.height / 2) / scaledSize + camera.y);
    setMouseGridPos({ x: worldX, y: worldY });

    const hovered = placements.find(p => {
        const s = p.size || 1;
        return worldX >= p.x && worldX < p.x + s && worldY >= p.y && worldY < p.y + s;
    });
    setHoveredId(hovered ? hovered.id : null);

    if (!isDragging.current) return;
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;
    
    setCamera(prev => ({
      ...prev,
      x: prev.x - dx / scaledSize,
      y: prev.y - dy / scaledSize
    }));
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = (e) => {
    if (isDragging.current) {
      const dx = Math.abs(e.clientX - lastMousePos.current.x);
      const dy = Math.abs(e.clientY - lastMousePos.current.y);
      if (dx < 5 && dy < 5) {
        const rect = canvasRef.current.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const scaledSize = TILE_SIZE * camera.zoom;
        const worldX = Math.floor((mx - rect.width / 2) / scaledSize + camera.x);
        const worldY = Math.floor((my - rect.height / 2) / scaledSize + camera.y);
        onPlace(worldX, worldY);
      }
    }
    isDragging.current = false;
  };

  const handleWheel = (e) => {
    setCamera(prev => ({
      ...prev,
      zoom: Math.max(0.2, Math.min(2, prev.zoom * (e.deltaY > 0 ? 0.9 : 1.1)))
    }));
  };

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => { isDragging.current = false; setHoveredId(null); }}
      onWheel={handleWheel}
      style={{ cursor: buildMode ? 'crosshair' : (isDragging.current ? 'grabbing' : 'grab'), display: 'block' }}
    />
  );
};

export default GameCanvas;
