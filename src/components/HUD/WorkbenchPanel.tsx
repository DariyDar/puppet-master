import React, { useState, useEffect } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { gameEvents } from '../../game/managers/EventManager';
import { UNIT_CONFIGS } from '../../game/config/PhaserConfig';

interface UnitConfig {
  id: string;
  name: string;
  health: number;
  damage: number;
  attackSpeed: number;
  moveSpeed: number;
  cost: {
    souls: number;
    scrap: number;
    polymer: number;
  };
  productionTime: number;
  unlockLevel: number;
}

export const WorkbenchPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isInRange, setIsInRange] = useState(false);
  const { resources, playerStats, armyCount } = useGameStore();

  // Listen for workbench range events
  useEffect(() => {
    const handleWorkbenchRange = (data: { inRange: boolean }) => {
      setIsInRange(data.inRange);
      if (!data.inRange) {
        setIsOpen(false);
      }
    };

    gameEvents.on('workbench:in-range', handleWorkbenchRange);

    return () => {
      gameEvents.off('workbench:in-range', handleWorkbenchRange);
    };
  }, []);

  const canAffordUnit = (config: UnitConfig): boolean => {
    return (
      resources.souls >= config.cost.souls &&
      resources.scrap >= config.cost.scrap &&
      resources.polymer >= config.cost.polymer &&
      armyCount.current < armyCount.max &&
      playerStats.level >= config.unlockLevel
    );
  };

  const handleProduceUnit = (unitType: string) => {
    const config = UNIT_CONFIGS[unitType as keyof typeof UNIT_CONFIGS];
    if (!config || !canAffordUnit(config as UnitConfig)) return;

    // Deduct resources
    useGameStore.getState().updateStorage({
      scrap: resources.scrap - config.cost.scrap,
      polymer: resources.polymer - config.cost.polymer,
      gems: resources.gems,
      souls: resources.souls - config.cost.souls,
    });

    // Spawn unit
    gameEvents.emit('unit:spawn-request', { unitType });
  };

  const unitList = Object.values(UNIT_CONFIGS) as UnitConfig[];

  if (!isInRange) return null;

  return (
    <>
      {/* Toggle button when in range */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: 100,
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(106, 90, 205, 0.9)',
            color: '#fff',
            border: '2px solid #6a5acd',
            borderRadius: '8px',
            padding: '12px 24px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer',
            zIndex: 1000,
          }}
        >
          OPEN WORKBENCH
        </button>
      )}

      {/* Workbench Panel */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(20, 20, 30, 0.95)',
            border: '3px solid #6a5acd',
            borderRadius: '12px',
            padding: '16px',
            minWidth: '320px',
            maxWidth: '90vw',
            maxHeight: '60vh',
            overflowY: 'auto',
            zIndex: 1001,
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px',
              borderBottom: '2px solid #6a5acd',
              paddingBottom: '8px',
            }}
          >
            <span style={{ color: '#6a5acd', fontSize: '16px', fontWeight: 'bold' }}>
              WORKBENCH
            </span>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#888',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '0 4px',
              }}
            >
              ×
            </button>
          </div>

          {/* Resources display */}
          <div
            style={{
              display: 'flex',
              gap: '16px',
              marginBottom: '12px',
              padding: '8px',
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '6px',
            }}
          >
            <div style={{ color: '#8844ff', fontSize: '12px' }}>
              <span style={{ fontWeight: 'bold' }}>Souls:</span> {resources.souls}
            </div>
            <div style={{ color: '#708090', fontSize: '12px' }}>
              <span style={{ fontWeight: 'bold' }}>Scrap:</span> {resources.scrap}
            </div>
            <div style={{ color: '#32cd32', fontSize: '12px' }}>
              <span style={{ fontWeight: 'bold' }}>Polymer:</span> {resources.polymer}
            </div>
          </div>

          {/* Army count */}
          <div
            style={{
              marginBottom: '12px',
              padding: '8px',
              backgroundColor: 'rgba(138, 43, 226, 0.2)',
              borderRadius: '6px',
              textAlign: 'center',
            }}
          >
            <span style={{ color: '#8a2be2', fontSize: '12px' }}>
              Army: {armyCount.current}/{armyCount.max}
            </span>
          </div>

          {/* Unit list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {unitList.map((config) => {
              const isUnlocked = playerStats.level >= config.unlockLevel;
              const canAfford = canAffordUnit(config);
              const armyFull = armyCount.current >= armyCount.max;

              return (
                <div
                  key={config.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '10px',
                    backgroundColor: isUnlocked ? 'rgba(106, 90, 205, 0.2)' : 'rgba(50, 50, 50, 0.5)',
                    borderRadius: '8px',
                    border: `2px solid ${isUnlocked ? '#6a5acd' : '#444'}`,
                    opacity: isUnlocked ? 1 : 0.5,
                  }}
                >
                  {/* Unit icon placeholder */}
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      backgroundColor: isUnlocked ? '#483d8b' : '#333',
                      borderRadius: '6px',
                      marginRight: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <span style={{ color: '#ff6666', fontSize: '20px' }}>●</span>
                  </div>

                  {/* Unit info */}
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>
                      {config.name}
                      {!isUnlocked && (
                        <span style={{ color: '#ff4444', fontSize: '10px', marginLeft: '8px' }}>
                          (Lvl {config.unlockLevel})
                        </span>
                      )}
                    </div>
                    <div style={{ color: '#888', fontSize: '10px', marginTop: '2px' }}>
                      HP: {config.health} | DMG: {config.damage} | SPD: {config.moveSpeed}
                    </div>
                    <div style={{ color: '#666', fontSize: '10px', marginTop: '2px' }}>
                      <span style={{ color: '#8844ff' }}>{config.cost.souls}⬡</span>
                      {' '}
                      <span style={{ color: '#708090' }}>{config.cost.scrap}⚙</span>
                      {' '}
                      <span style={{ color: '#32cd32' }}>{config.cost.polymer}◆</span>
                    </div>
                  </div>

                  {/* Produce button */}
                  <button
                    onClick={() => handleProduceUnit(config.id)}
                    disabled={!isUnlocked || !canAfford || armyFull}
                    style={{
                      backgroundColor: canAfford && isUnlocked && !armyFull ? '#6a5acd' : '#444',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px 16px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      cursor: canAfford && isUnlocked && !armyFull ? 'pointer' : 'not-allowed',
                      opacity: canAfford && isUnlocked && !armyFull ? 1 : 0.5,
                    }}
                  >
                    {armyFull ? 'FULL' : 'BUILD'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
};
