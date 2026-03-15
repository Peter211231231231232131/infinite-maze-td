import { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'
import GameCanvas from './components/GameCanvas'
import HUD from './components/HUD'
import Minimap from './components/Minimap'
import { TILE_TYPES, getTileAt, setGlobalSeed } from './game/MazeEngine'
import { pathfinder } from './game/Pathfinder'
import { spatialHash } from './utils/SpatialHash'

const INITIAL_PLACEMENTS = [
  { id: 'core', x: 0, y: 0, type: 'core', health: 1200, maxHealth: 1200, vision: 6, level: 1 }
];

const TOWER_TYPES = {
  drill: { cost: 50, vision: 4, range: 0, health: 100 },
  tower: { cost: 100, vision: 7, range: 6, health: 150, damage: 8, fireRate: 1000 },
  beam: { cost: 180, vision: 8, range: 7, health: 120, damage: 2, fireRate: 120 }, 
  blast: { cost: 250, vision: 6, range: 5, health: 220, damage: 40, fireRate: 2200, splash: 2.5 },
  shock: { cost: 150, vision: 6, range: 4, health: 180, damage: 5, fireRate: 1500, slow: 0.5 },
  expander: { cost: 30, vision: 15, range: 0, health: 80 }, // High vision, cheap, no attack
  factory: { cost: 80, vision: 3, range: 0, health: 150, size: 2 }, // 2x2 multi-tile
  supply: { cost: 50, vision: 5, range: 6, health: 100 }   // Distributes ammo
};

function App() {
  const [resources, setResources] = useState({ aether: 300, towers: 0, bullets: 100 });
  const [wave, setWave] = useState(1);
  const [placements, setPlacements] = useState(INITIAL_PLACEMENTS);
  const [enemies, setEnemies] = useState([]);
  const [projectiles, setProjectiles] = useState([]);
  const [coreHealth, setCoreHealth] = useState(100);
  const [buildMode, setBuildMode] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 0.8 });
  const [gameOver, setGameOver] = useState(false);
  const [particles, setParticles] = useState([]);
  const [floatingTexts, setFloatingTexts] = useState([]);

  // Initialize fresh map each run
  useEffect(() => {
    const freshSeed = Math.floor(Math.random() * 1000000);
    setGlobalSeed(freshSeed);
  }, []);

  const placementsRef = useRef(placements);
  const enemiesRef = useRef(enemies);
  const resourcesRef = useRef(resources);
  const lastSpawnRef = useRef(Date.now());
  const bountyQueue = useRef(0);
  const bulletConsumeQueue = useRef(0);
  const bulletProduceQueue = useRef(0);

  useEffect(() => {
    placementsRef.current = placements;
    enemiesRef.current = enemies;
    resourcesRef.current = resources;
  }, [placements, enemies, resources]);

  const addFloatingText = useCallback((text, x, y, color = '#fff') => {
    setFloatingTexts(prev => [...prev, {
      id: Math.random(),
      text, x, y,
      life: 1,
      color
    }]);
  }, []);

  // Game Loop
  useEffect(() => {
    if (gameOver) return;

    const interval = setInterval(() => {
      const now = Date.now();

      // 0. Rebuild Spatial Hash for this frame
      spatialHash.clear();
      const currentPlacements = placementsRef.current;
      const currentEnemies = enemiesRef.current;
      currentPlacements.forEach(p => spatialHash.insert({ ...p, isPlacement: true }));
      currentEnemies.forEach(e => spatialHash.insert({ ...e, isEnemy: true }));

      // 1. Move & Update Enemies
      setEnemies(prevEnemies => {
        return prevEnemies.map(enemy => {
          // Smart Hibernation: if very far, update at 1/10th frequency
          const distToCore = Math.abs(enemy.x) + Math.abs(enemy.y);
          if (distToCore > 60) {
              // Only move every 500ms instead of every 50ms
              if (now % 500 > 50) return enemy; 
              
              // Simplified movement (straight line toward core)
              const dxInput = -Math.sign(enemy.x);
              const dyInput = -Math.sign(enemy.y);
              enemy.x += dxInput * enemy.speed * 10; // Compensate for slower tick
              enemy.y += dyInput * enemy.speed * 10;
              enemy.path = null; // Force recalculate when waking up
              return enemy;
          }

          // Anti-Stuck: if inside a wall, nudge out
          if (getTileAt(Math.round(enemy.x), Math.round(enemy.y)) === TILE_TYPES.WALL) {
              enemy.x += (Math.random() - 0.5) * 0.5;
              enemy.y += (Math.random() - 0.5) * 0.5;
              enemy.path = null;
          }

          if (!enemy.path || enemy.path.length === 0) {
            // Strategic Targeting Logic:
            // Find nearest "distraction" within 12 tiles
            const sightings = spatialHash.query(enemy.x, enemy.y, 12);
            let targetPos = { x: 0, y: 0 };
            
            // Prioritize non-core targets if they are close
            const distraction = sightings.find(s => s.isPlacement && (s.type === 'drill' || s.type === 'expander' || s.type === 'tower'));
            if (distraction) {
                targetPos = { x: distraction.x, y: distraction.y };
            }

            const path = pathfinder.findPath(
                { x: Math.round(enemy.x), y: Math.round(enemy.y) }, 
                targetPos
            );
            
            enemy.path = path || [];
            // Anti-backtracking: the path includes the start node. Skip it so they don't turn around!
            if (enemy.path.length > 1) {
                enemy.path.shift();
            }
            enemy.lastStrategicRecheck = now;
          }

          // Periodic re-check to see if a closer target appeared
          if (now - (enemy.lastStrategicRecheck || 0) > 3000) {
              enemy.path = null;
          }

          // Optimized Attack Detection using Spatial Hash
          const nearbyPlacements = spatialHash.query(enemy.x, enemy.y, 1.2).filter(item => item.isPlacement);
          let targetPlacement = nearbyPlacements[0] || null;

          if (targetPlacement) {
            // Check if the placement still exists in the current ref
            const exists = placementsRef.current.some(p => p.id === targetPlacement.id);
            if (exists) {
                setPlacements(prev => {
                  let changed = false;
                  const next = prev.map(p => {
                    if (p.id === targetPlacement.id) {
                      const damage = (0.4 + (wave * 0.05)) / (targetPlacement.type === 'core' ? 4 : 1);
                      const newHealth = p.health - damage;
                      changed = true;
                      if (p.type === 'core') {
                        setCoreHealth(Math.max(0, Math.floor((newHealth / p.maxHealth) * 100)));
                        if (newHealth <= 0) setGameOver(true);
                      }
                      return { ...p, health: newHealth };
                    }
                    return p;
                  }).filter(p => p.health > 0);
                  return changed ? next : prev;
                });

                // Stacking prevention: nudge enemy slightly if on top of target
                const nx = targetPlacement.x - enemy.x;
                const ny = targetPlacement.y - enemy.y;
                const ndist = Math.sqrt(nx*nx + ny*ny);
                if (ndist < 0.3) {
                    enemy.x -= (nx/ndist || 0) * 0.05;
                    enemy.y -= (ny/ndist || 0) * 0.05;
                }
                
                return enemy; // DO NOT RETURN NULL - stay alive and keep attacking!
            }
          }

          if (enemy.path && enemy.path.length > 0) {
            const target = enemy.path[0];
            const dx = target.x - enemy.x;
            const dy = target.y - enemy.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            const isSlowed = enemy.slowUntil && now < enemy.slowUntil;
            const currentSpeed = isSlowed ? enemy.speed * (1 - enemy.slowFactor) : enemy.speed;

            if (dist < currentSpeed) {
              enemy.path.shift();
            } else {
              enemy.x += (dx / dist) * currentSpeed;
              enemy.y += (dy / dist) * currentSpeed;
            }
          } else {
             enemy.x -= Math.sign(enemy.x) * 0.02;
             enemy.y -= Math.sign(enemy.y) * 0.02;
          }

          return enemy;
        }).filter(Boolean);
      });

      // 2. Tower Shooting & Logistics (Optimized with Spatial Hash)
      setPlacements(prevPlacements => {
        let stateChanged = false;
        
        // Find active supply network
        const supplyTowers = prevPlacements.filter(p => p.type === 'supply');
        const isConnected = (targetP) => {
            return supplyTowers.some(s => {
                const dx = s.x - targetP.x;
                const dy = s.y - targetP.y;
                return dx * dx + dy * dy <= s.range * s.range;
            });
        };

        const nextPlacements = prevPlacements.map(p => {
          // Logistics Factory Processing
          if (p.type === 'factory') {
              if (isConnected(p)) {
                  bulletProduceQueue.current += 0.1 * p.level; // 2 bullets / sec
                  p.outOfAmmo = false;
              } else {
                  p.outOfAmmo = true; // Show warning icon if disconnected
              }
              return p; // Factories don't shoot
          }

          if (p.type && TOWER_TYPES[p.type] && TOWER_TYPES[p.type].range > 0) {
            const spec = TOWER_TYPES[p.type];
            if (!p.lastShot) p.lastShot = 0;
            const effectiveFireRate = spec.fireRate / (1 + (p.level - 1) * 0.4);
            
            if (now - p.lastShot > effectiveFireRate) {
              // Query nearby enemies using Spatial Hash (we update hash with current enemies)
              // NOTE: For now enemies aren't in hash yet, let's use currentEnemies
              let nearestEnemy = null;
              let minDistSq = p.range * p.range;

              // Optimization: We now use the Spatial Hash grid instead of global iteration
              const nearby = spatialHash.query(p.x, p.y, p.range);
              const enemiesInRange = nearby.filter(item => item.isEnemy);
              
              enemiesInRange.forEach(e => {
                const dx = e.x - p.x;
                const dy = e.y - p.y;
                const d2 = dx * dx + dy * dy;
                if (d2 < minDistSq) {
                  minDistSq = d2;
                  nearestEnemy = e;
                }
              });

              if (nearestEnemy) {
                // Mutate the object angle directly for the rendering engine 
                p.angle = Math.atan2(nearestEnemy.y - p.y, nearestEnemy.x - p.x);
              }

              if (now - p.lastShot > effectiveFireRate && nearestEnemy) {
                // Ammo Check!
                if (spec.damage > 0) { // Attacking towers require bullets and a supply line
                    const activeSupply = isConnected(p);
                    const hasGlobalAmmo = (resourcesRef.current.bullets - bulletConsumeQueue.current) >= 1;
                    
                    if (!activeSupply || !hasGlobalAmmo) {
                        p.outOfAmmo = true;
                        return p; // Jammed/Disconnected
                    }
                    
                    p.outOfAmmo = false;
                    bulletConsumeQueue.current += 1; // Spend 1 bullet
                }

                p.lastShot = now;
                stateChanged = true;
                
                const damage = (spec.damage + (p.level - 1) * (spec.damage * 0.5));
                const isSplash = !!spec.splash;

                setProjectiles(prev => [...prev, {
                  id: Math.random(),
                  startX: p.x + 0.5,
                  startY: p.y + 0.5,
                  endX: nearestEnemy.x + 0.5,
                  endY: nearestEnemy.y + 0.5,
                  startTime: now,
                  duration: isSplash ? 300 : 120,
                  type: p.type
                }]);

                setEnemies(prev => {
                    return prev.map(e => {
                        const dx = e.x - nearestEnemy.x;
                        const dy = e.y - nearestEnemy.y;
                        const distSq = dx * dx + dy * dy;

                        if (e.id === nearestEnemy.id || (isSplash && distSq < spec.splash * spec.splash)) {
                            const newH = e.health - damage;
                            if (spec.slow) {
                                e.slowUntil = now + 2000;
                                e.slowFactor = spec.slow;
                            }
                            if (newH <= 0 && !e.dead) {
                                e.dead = true;
                                bountyQueue.current += (2 + wave);
                                addFloatingText(`+${2 + wave}`, e.x, e.y, '#00f2fe');
                                const particleCount = e.type === 'tank' ? 15 : 6;
                                const newP = Array.from({length: particleCount}).map(() => ({
                                    id: Math.random(),
                                    x: e.x + 0.5,
                                    y: e.y + 0.5,
                                    vx: (Math.random() - 0.5) * 0.3,
                                    vy: (Math.random() - 0.5) * 0.3,
                                    life: 1,
                                    color: e.type === 'tank' ? '#ff9900' : '#ff4d4d'
                                }));
                                setParticles(parts => [...parts, ...newP]);
                            }
                            return { ...e, health: newH };
                        }
                        return e;
                    }).filter(e => e.health > 0);
                });
              }
            }
          }
          return p;
        });
        return stateChanged ? nextPlacements : prevPlacements;
      });

      // 3. Update Visuals & Resources
      setProjectiles(prev => prev.filter(p => now - p.startTime < p.duration));
      setParticles(prev => prev.map(p => ({
          ...p, x: p.x + p.vx, y: p.y + p.vy, life: p.life - 0.05
      })).filter(p => p.life > 0));
      setFloatingTexts(prev => prev.map(t => ({
          ...t, y: t.y - 0.02, life: t.life - 0.02
      })).filter(t => t.life > 0));

      setResources(prev => {
        let addedAether = 0.1; // Base 2/sec
        placementsRef.current.forEach(p => {
          if (p.type === 'drill') addedAether += 0.08 * p.level;
        });
        
        const totalAddedAether = addedAether + bountyQueue.current;
        bountyQueue.current = 0; // Flush queue
        
        const newBullets = Math.max(0, prev.bullets + bulletProduceQueue.current - bulletConsumeQueue.current);
        bulletProduceQueue.current = 0;
        bulletConsumeQueue.current = 0;
        
        return { 
            ...prev, 
            aether: prev.aether + totalAddedAether,
            bullets: newBullets 
        };
      });

      // 4. Wave & Spawning
      const spawnCooldown = 1200 - (wave * 40);
      if (now - lastSpawnRef.current > Math.max(250, spawnCooldown)) {
         lastSpawnRef.current = now;
         
         // Try up to 10 times to find a spawn point entirely hidden in the fog
         let spawnX, spawnY, valid = false;
         for (let i = 0; i < 10; i++) {
             const angle = Math.random() * Math.PI * 2;
             const dist = 25 + Math.random() * 25; // Search further out
             spawnX = Math.round(Math.cos(angle) * dist);
             spawnY = Math.round(Math.sin(angle) * dist);
             
             if (getTileAt(spawnX, spawnY) !== TILE_TYPES.WALL) {
                 const isVisible = placementsRef.current.some(p => {
                     const dx = p.x - spawnX;
                     const dy = p.y - spawnY;
                     return dx * dx + dy * dy <= p.vision * p.vision;
                 });
                 
                 // If no tower/drill can see this tile, it's valid!
                 if (!isVisible) {
                     valid = true;
                     break;
                 }
             }
         }
         
         if (valid) {
            const typeRoll = Math.random();
            let type = 'normal', health = 15 + wave * 5, speed = 0.025 + Math.random() * 0.02, color = '#ff4d4d';
            if (typeRoll < 0.2 && wave > 2) { type = 'fast'; health = 8 + wave * 2; speed *= 2.4; color = '#ffff00'; }
            else if (typeRoll < 0.4 && wave > 4) { type = 'tank'; health = 60 + wave * 25; speed *= 0.55; color = '#ff00ff'; }

            setEnemies(prev => [...prev.slice(-150), { // Cap total enemies for performance
              id: Math.random(), type, x: spawnX, y: spawnY,
              health, maxHealth: health, speed, color, path: null
            }]);
         }
      }

      if (Math.random() < 0.0006) {
         setWave(w => {
             addFloatingText(`WAVE ${w + 1}`, 0, -2, '#fe00f2');
             return w + 1;
         });
      }
    }, 50);

    return () => clearInterval(interval);
  }, [wave, gameOver, addFloatingText]);

  const handlePlace = (x, y) => {
    if (!buildMode) {
        const p = placements.find(p => p.x === x && p.y === y);
        setSelectedId(p ? p.id : null);
        return;
    }

    const spec = TOWER_TYPES[buildMode];
    if (resources.aether < spec.cost) return;

    const size = spec.size || 1;
    
    // Check footprint validity
    for (let dy = 0; dy < size; dy++) {
        for (let dx = 0; dx < size; dx++) {
            const tx = x + dx;
            const ty = y + dy;
            const tile = getTileAt(tx, ty);
            if (tile === TILE_TYPES.WALL) return;
            if (buildMode === 'drill' && tile !== TILE_TYPES.CRYSTAL) return;
            
            // Check for collision with existing placements
            if (placements.some(p => {
                const pSize = TOWER_TYPES[p.type]?.size || 1;
                return tx >= p.x && tx < p.x + pSize && ty >= p.y && ty < p.y + pSize;
            })) return;
        }
    }

    setResources(prev => ({ ...prev, aether: prev.aether - spec.cost }));
    setPlacements(prev => [
      ...prev,
      { 
        id: Math.random().toString(),
        x, y, 
        type: buildMode, 
        size,
        level: 1,
        health: spec.health, 
        maxHealth: spec.health,
        vision: spec.vision,
        range: spec.range,
        lastShot: 0
      }
    ]);
  };

  const handleUpgrade = () => {
    if (!selectedId) return;
    const p = placements.find(p => p.id === selectedId);
    if (!p) return;

    const baseCost = TOWER_TYPES[p.type].cost;
    const upgradeCost = Math.floor(baseCost * 0.8 * p.level);
    
    if (resources.aether < upgradeCost) return;

    setResources(prev => ({ ...prev, aether: prev.aether - upgradeCost }));
    setPlacements(prev => prev.map(item => {
        if (item.id === selectedId) {
            return {
                ...item,
                level: item.level + 1,
                health: item.maxHealth + 60,
                maxHealth: item.maxHealth + 60,
                range: item.range > 0 ? item.range + 0.6 : 0,
                vision: item.vision + 0.6
            };
        }
        return item;
    }));
  };

  return (
    <div className="game-container">
      <GameCanvas 
        placements={placements} 
        enemies={enemies} 
        projectiles={projectiles}
        particles={particles}
        floatingTexts={floatingTexts}
        camera={camera}
        setCamera={setCamera}
        onPlace={handlePlace}
        buildMode={buildMode}
        selectedId={selectedId}
        towerTypes={TOWER_TYPES}
      />
      <h1>Aether Maze TD</h1>
      <Minimap placements={placements} enemies={enemies} camera={camera} setCamera={setCamera} />
      <HUD 
        resources={{...resources, coreHealth}} 
        wave={wave} 
        setBuildMode={setBuildMode}
        buildMode={buildMode}
        selectedPlacement={placements.find(p => p.id === selectedId)}
        onUpgrade={handleUpgrade}
        towerTypes={TOWER_TYPES}
      />
      {gameOver && (
        <div className="game-over glass">
          <h2>Core Collapsed</h2>
          <p>You survived {wave} waves</p>
          <button onClick={() => window.location.reload()}>Restart</button>
        </div>
      )}
    </div>
  )
}

export default App
