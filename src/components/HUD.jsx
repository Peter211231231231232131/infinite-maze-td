import { Pickaxe, Shield, TrendingUp, Zap, Heart, ArrowUpCircle, ZapOff, Target, Eye, Factory, Radio, Crosshair } from 'lucide-react';

const HUD = ({ resources, wave, setBuildMode, buildMode, selectedPlacement, onUpgrade, towerTypes }) => {
  const upgradeCost = selectedPlacement 
    ? Math.floor(towerTypes[selectedPlacement.type].cost * 0.8 * selectedPlacement.level) 
    : 0;

  return (
    <div className="hud-container">
      <div className="stats-panel glass">
        <div className="stat-item tooltip" title="Aether Resources">
          <Pickaxe size={20} className="icon-aether" />
          <span className="stat-value">{Math.floor(resources.aether)}</span>
        </div>
        <div className="stat-item tooltip" title="Ammunition Stockpile">
          <Crosshair size={20} style={{ color: '#ff9900' }} />
          <span className="stat-value">{Math.floor(resources.bullets)}</span>
        </div>
        
        <div className="stat-item core-health-panel">
          <Heart size={20} className="icon-power" />
          <div className="health-bar-bg">
            <div 
              className="health-bar-fill" 
              style={{ width: `${resources.coreHealth}%` }}
            ></div>
          </div>
          <span className="stat-value">{resources.coreHealth}%</span>
        </div>

        <div className="stat-item">
          <TrendingUp size={20} className="icon-wave" />
          <span className="stat-label">Wave</span>
          <span className="stat-value">{wave}</span>
        </div>
      </div>

      <div className="side-panels">
        <div className="build-menu glass">
          <button 
            className={`build-btn ${buildMode === 'drill' ? 'active' : ''}`} 
            onClick={() => setBuildMode(buildMode === 'drill' ? null : 'drill')}
            title="Mining Drill: Place on crystals to gather Aether"
          >
             <Pickaxe size={24} style={{color: '#00fe4f'}} />
             <span className="cost">50</span>
          </button>
          <button 
            className={`build-btn ${buildMode === 'tower' ? 'active' : ''}`} 
            onClick={() => setBuildMode(buildMode === 'tower' ? null : 'tower')}
            title="Pulse Tower: standard defense"
          >
             <Shield size={24} style={{color: '#f2fe00'}} />
             <span className="cost">100</span>
          </button>
          <button 
            className={`build-btn ${buildMode === 'beam' ? 'active' : ''}`} 
            onClick={() => setBuildMode(buildMode === 'beam' ? null : 'beam')}
            title="Beam Tower: high frequency laser"
          >
             <Zap size={24} style={{color: '#00ccff'}} />
             <span className="cost">200</span>
          </button>
          <button 
            className={`build-btn ${buildMode === 'blast' ? 'active' : ''}`} 
            onClick={() => setBuildMode(buildMode === 'blast' ? null : 'blast')}
            title="Blast Tower: heavy splash damage"
          >
             <Target size={24} style={{color: '#ff6600'}} />
             <span className="cost">250</span>
          </button>
          <button 
            className={`build-btn ${buildMode === 'shock' ? 'active' : ''}`} 
            onClick={() => setBuildMode(buildMode === 'shock' ? null : 'shock')}
            title="Shock Tower: slows enemies"
          >
             <ZapOff size={24} style={{color: '#cc00ff'}} />
             <span className="cost">150</span>
          </button>
          <button 
            className={`build-btn ${buildMode === 'expander' ? 'active' : ''}`} 
            onClick={() => setBuildMode(buildMode === 'expander' ? null : 'expander')}
            title="Expander: massive vision, very cheap"
          >
             <Eye size={24} style={{color: '#fff'}} />
             <span className="cost">30</span>
          </button>
          <button 
            className={`build-btn ${buildMode === 'factory' ? 'active' : ''}`} 
            onClick={() => setBuildMode(buildMode === 'factory' ? null : 'factory')}
            title="Bullet Factory: Produces ammunition"
          >
             <Factory size={24} style={{color: '#ff9900'}} />
             <span className="cost">80</span>
          </button>
          <button 
            className={`build-btn ${buildMode === 'supply' ? 'active' : ''}`} 
            onClick={() => setBuildMode(buildMode === 'supply' ? null : 'supply')}
            title="Pipeline: Connects Bullet Factory and Defense Towers"
          >
             <Radio size={24} style={{color: '#00ccff'}} />
             <span className="cost">50</span>
          </button>
          
          {buildMode && (
            <div className="build-hint">
              Placing: {buildMode.toUpperCase()}
            </div>
          )}
        </div>

        {selectedPlacement && (
          <div className="selection-panel glass animate-slide-in">
            <h3 className="panel-title">{selectedPlacement.type.toUpperCase()} LV. {selectedPlacement.level}</h3>
            <div className="panel-stats">
              <p>Health: {Math.floor(selectedPlacement.health)}/{selectedPlacement.maxHealth}</p>
              {selectedPlacement.range > 0 && <p>Range: {selectedPlacement.range.toFixed(1)}</p>}
              <p>Vision: {selectedPlacement.vision.toFixed(1)}</p>
            </div>
            <button 
              className="upgrade-btn" 
              onClick={onUpgrade}
              disabled={resources.aether < upgradeCost}
            >
              <ArrowUpCircle size={18} />
              Upgrade ({upgradeCost})
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default HUD;
