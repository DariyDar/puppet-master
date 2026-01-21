import React, { useState } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { gameEvents } from '../../game/managers/EventManager';
import { UNIT_CONFIGS } from '../../game/config/PhaserConfig';

export const DebugMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { resources, addToStorage } = useGameStore();

  const handleSpawnUnit = (unitType: string) => {
    gameEvents.emit('unit:spawn-request', { unitType });
  };

  const handleAddCurrency = (type: 'scrap' | 'polymer' | 'gems' | 'souls', amount: number) => {
    addToStorage(type, amount);
    gameEvents.emit('storage:updated', {
      scrap: resources.scrap + (type === 'scrap' ? amount : 0),
      polymer: resources.polymer + (type === 'polymer' ? amount : 0),
      gems: resources.gems + (type === 'gems' ? amount : 0),
      souls: resources.souls + (type === 'souls' ? amount : 0),
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        zIndex: 2000,
        pointerEvents: 'auto',
      }}
    >
      {/* Hidden Toggle Button - 40px tap area but nearly invisible */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '40px',
          height: '40px',
          backgroundColor: 'transparent',
          border: 'none',
          cursor: 'default',
          opacity: isOpen ? 1 : 0.01,
          transition: 'opacity 0.2s ease',
        }}
        title=""
      >
        {isOpen && (
          <span style={{ color: '#ffd700', fontSize: '20px' }}>✖</span>
        )}
      </button>

      {/* Debug Panel */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '50px',
            right: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            border: '2px solid #ffd700',
            borderRadius: '8px',
            padding: '12px',
            minWidth: '200px',
            maxHeight: '70vh',
            overflowY: 'auto',
          }}
        >
          <div style={{ color: '#ffd700', fontSize: '14px', fontWeight: 'bold', marginBottom: '12px' }}>
            DEBUG MENU
          </div>

          {/* Spawn Units Section */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ color: '#8a2be2', fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>
              SPAWN UNITS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {Object.entries(UNIT_CONFIGS).map(([key, config]) => (
                <button
                  key={key}
                  onClick={() => handleSpawnUnit(key)}
                  style={{
                    padding: '6px 10px',
                    backgroundColor: 'rgba(138, 43, 226, 0.3)',
                    border: '1px solid #8a2be2',
                    borderRadius: '4px',
                    color: '#fff',
                    fontSize: '11px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(138, 43, 226, 0.5)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(138, 43, 226, 0.3)')}
                >
                  + {config.name}
                </button>
              ))}
            </div>
          </div>

          {/* Add Currencies Section */}
          <div>
            <div style={{ color: '#ffa500', fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>
              ADD RESOURCES
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <button
                onClick={() => handleAddCurrency('scrap', 100)}
                style={{
                  padding: '6px 10px',
                  backgroundColor: 'rgba(224, 112, 80, 0.3)',
                  border: '1px solid #e07050',
                  borderRadius: '4px',
                  color: '#fff',
                  fontSize: '11px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(224, 112, 80, 0.5)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(224, 112, 80, 0.3)')}
              >
                + 100 Meat
              </button>
              <button
                onClick={() => handleAddCurrency('polymer', 50)}
                style={{
                  padding: '6px 10px',
                  backgroundColor: 'rgba(139, 69, 19, 0.3)',
                  border: '1px solid #8B4513',
                  borderRadius: '4px',
                  color: '#fff',
                  fontSize: '11px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(139, 69, 19, 0.5)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(139, 69, 19, 0.3)')}
              >
                + 50 Wood
              </button>
              <button
                onClick={() => handleAddCurrency('gems', 10)}
                style={{
                  padding: '6px 10px',
                  backgroundColor: 'rgba(255, 215, 0, 0.3)',
                  border: '1px solid #FFD700',
                  borderRadius: '4px',
                  color: '#fff',
                  fontSize: '11px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 215, 0, 0.5)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 215, 0, 0.3)')}
              >
                + 10 Gold
              </button>
              <button
                onClick={() => handleAddCurrency('souls', 10)}
                style={{
                  padding: '6px 10px',
                  backgroundColor: 'rgba(148, 0, 211, 0.3)',
                  border: '1px solid #9400d3',
                  borderRadius: '4px',
                  color: '#fff',
                  fontSize: '11px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(148, 0, 211, 0.5)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(148, 0, 211, 0.3)')}
              >
                + 10 Skulls
              </button>
            </div>
          </div>

          {/* Current Resources Display */}
          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.2)' }}>
            <div style={{ color: '#888', fontSize: '10px', marginBottom: '4px' }}>CURRENT:</div>
            <div style={{ color: '#e07050', fontSize: '10px' }}>Meat: {resources.scrap}</div>
            <div style={{ color: '#8B4513', fontSize: '10px' }}>Wood: {resources.polymer}</div>
            <div style={{ color: '#FFD700', fontSize: '10px' }}>Gold: {resources.gems}</div>
            <div style={{ color: '#9400d3', fontSize: '10px' }}>Skulls: {resources.souls}</div>
          </div>

          {/* Reset Progress */}
          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.2)' }}>
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to reset ALL progress? This cannot be undone!')) {
                  localStorage.removeItem('puppet-master-save');
                  window.location.reload();
                }
              }}
              style={{
                width: '100%',
                padding: '8px',
                backgroundColor: 'rgba(255, 0, 0, 0.3)',
                border: '1px solid #ff4444',
                borderRadius: '4px',
                color: '#ff4444',
                fontSize: '11px',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              RESET PROGRESS
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
