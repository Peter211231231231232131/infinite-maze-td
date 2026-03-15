import React, { useEffect, useRef } from 'react';
import { getTileAt, TILE_TYPES } from '../game/MazeEngine';

const Minimap = ({ placements, enemies, camera, setCamera }) => {
  const canvasRef = useRef(null);
  const size = 200; 
  const viewSize = 250; // Radius around camera

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Background (Fog)
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, size, size);
    
    const scale = size / viewSize;
    const centerOffset = viewSize / 2;
    const camX = Math.round(camera.x);
    const camY = Math.round(camera.y);

    // 1. Draw Maze (Camera Centric + Fog of War)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    for (let x = -centerOffset; x < centerOffset; x += 4) {
      for (let y = -centerOffset; y < centerOffset; y += 4) {
        const wx = camX + x;
        const wy = camY + y;
        
        // Visibility Check (Fog of War)
        let isVisible = false;
        for (let i = 0; i < placements.length; i++) {
          const p = placements[i];
          const dx = p.x - wx;
          const dy = p.y - wy;
          if (dx*dx + dy*dy <= p.vision * p.vision) {
            isVisible = true;
            break;
          }
        }
        if (!isVisible) continue;

        if (getTileAt(wx, wy) === TILE_TYPES.WALL) {
          ctx.fillRect((x + centerOffset) * scale, (y + centerOffset) * scale, scale * 4, scale * 4);
        }
      }
    }

    // 2. Draw Placements (Only if visible)
    placements.forEach(p => {
      const rx = p.x - camX;
      const ry = p.y - camY;
      
      if (Math.abs(rx) < centerOffset && Math.abs(ry) < centerOffset) {
          const px = (rx + centerOffset) * scale;
          const py = (ry + centerOffset) * scale;
          const ps = (p.size || 1) * scale;
          
          if (p.type === 'core') {
              ctx.fillStyle = '#ff00ff';
              ctx.shadowBlur = 10;
              ctx.shadowColor = '#ff00ff';
          } else if (p.type === 'drill') {
              ctx.fillStyle = '#00f2fe';
          } else {
              ctx.fillStyle = '#00fe4f';
          }
          ctx.fillRect(px, py, ps, ps);
          ctx.shadowBlur = 0;
      }
    });

    // 3. Draw Enemies (Only if visible)
    ctx.fillStyle = '#ff4d4d';
    enemies.forEach(e => {
        const rx = e.x - camX;
        const ry = e.y - camY;
        if (Math.abs(rx) < centerOffset && Math.abs(ry) < centerOffset) {
            // Check visibility for enemy
            let isVisible = false;
            for (let i = 0; i < placements.length; i++) {
              const p = placements[i];
              const dx = p.x - e.x;
              const dy = p.y - e.y;
              if (dx*dx + dy*dy <= p.vision * p.vision) {
                isVisible = true;
                break;
              }
            }
            if (!isVisible) return;
            ctx.fillRect((rx + centerOffset) * scale, (ry + centerOffset) * scale, scale * 2, scale * 2);
        }
    });

    // 4. Perspective Square (Viewport)
    const TILE_SIZE = 64;
    const viewWidthTiles = window.innerWidth / (TILE_SIZE * camera.zoom);
    const viewHeightTiles = window.innerHeight / (TILE_SIZE * camera.zoom);
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(
        (centerOffset - viewWidthTiles/2) * scale,
        (centerOffset - viewHeightTiles/2) * scale,
        viewWidthTiles * scale,
        viewHeightTiles * scale
    );

    // 5. Compass Indicator for Core (0,0) if far away
    const distToCoreSq = camX*camX + camY*camY;
    if (distToCoreSq > (viewSize/2)*(viewSize/2)) {
        const angle = Math.atan2(-camY, -camX);
        ctx.save();
        ctx.translate(size/2, size/2);
        ctx.rotate(angle);
        ctx.fillStyle = '#ff00ff';
        ctx.beginPath();
        ctx.moveTo(size/2.5, 0); ctx.lineTo(size/2.5 - 10, -5); ctx.lineTo(size/2.5 - 10, 5);
        ctx.fill();
        ctx.restore();
    }

    // Grid overlays for tech feel
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.1)';
    ctx.strokeRect(0, 0, size, size);

  }, [placements, enemies, camera]);

  const handleInteract = (e) => {
      const rect = canvasRef.current.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      
      const dx = (mx / size) * viewSize - (viewSize / 2);
      const dy = (my / size) * viewSize - (viewSize / 2);
      
      setCamera(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
  };

  return (
    <div className="minimap-container glass">
      <div className="minimap-header">
        <span className="minimap-label">POS: {Math.floor(camera.x)},{Math.floor(camera.y)}</span>
        <button className="core-jump-btn" onClick={() => setCamera(p => ({...p, x:0, y:0}))} title="Jump to Core">CORE</button>
      </div>
      <canvas ref={canvasRef} width={size} height={size} onClick={handleInteract} />
    </div>
  );
};

export default Minimap;

