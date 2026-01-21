import React, { useState } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { gameEvents } from '../../game/managers/EventManager';

interface UpgradeConfig {
  id: string;
  name: string;
  description: string;
  baseCost: { scrap: number; polymer: number };
  costMultiplier: number;
  maxLevel: number;
  icon: string;
}

const UPGRADE_CONFIGS: UpgradeConfig[] = [
  {
    id: 'health',
    name: 'Max Health',
    description: '+20 HP per level',
    baseCost: { scrap: 50, polymer: 10 },
    costMultiplier: 1.5,
    maxLevel: 10,
    icon: '❤️',
  },
  {
    id: 'damage',
    name: 'Attack Power',
    description: '+5 DMG per level',
    baseCost: { scrap: 40, polymer: 20 },
    costMultiplier: 1.5,
    maxLevel: 10,
    icon: '⚔️',
  },
  {
    id: 'speed',
    name: 'Move Speed',
    description: '+10% speed per level',
    baseCost: { scrap: 30, polymer: 30 },
    costMultiplier: 1.5,
    maxLevel: 5,
    icon: '🏃',
  },
  {
    id: 'cargo',
    name: 'Cargo Capacity',
    description: '+25 cargo per level',
    baseCost: { scrap: 60, polymer: 15 },
    costMultiplier: 1.3,
    maxLevel: 8,
    icon: '📦',
  },
  {
    id: 'attackSpeed',
    name: 'Attack Speed',
    description: '-10% attack cooldown',
    baseCost: { scrap: 35, polymer: 25 },
    costMultiplier: 1.6,
    maxLevel: 5,
    icon: '⚡',
  },
  {
    id: 'drainSpeed',
    name: 'Soul Drain Speed',
    description: '-15% drain time',
    baseCost: { scrap: 20, polymer: 40 },
    costMultiplier: 1.4,
    maxLevel: 5,
    icon: '👻',
  },
];

export const UpgradePanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { resources, upgradeLevels, purchaseUpgrade } = useGameStore();

  const calculateCost = (config: UpgradeConfig, currentLevel: number) => {
    const multiplier = Math.pow(config.costMultiplier, currentLevel);
    return {
      scrap: Math.floor(config.baseCost.scrap * multiplier),
      polymer: Math.floor(config.baseCost.polymer * multiplier),
    };
  };

  const canAfford = (cost: { scrap: number; polymer: number }) => {
    return resources.scrap >= cost.scrap && resources.polymer >= cost.polymer;
  };

  const handleUpgrade = (config: UpgradeConfig) => {
    const currentLevel = upgradeLevels[config.id] || 0;
    if (currentLevel >= config.maxLevel) return;

    const cost = calculateCost(config, currentLevel);
    if (!canAfford(cost)) return;

    // Deduct resources and upgrade
    purchaseUpgrade(config.id, cost);

    // Emit upgrade event for Phaser to handle
    gameEvents.emit('player:upgrade-purchased', {
      upgradeId: config.id,
      newLevel: currentLevel + 1,
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 160, // Above joystick (120px + 20px padding + 20px gap)
        left: 20,
        zIndex: 1500,
        pointerEvents: 'auto',
      }}
    >
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: '10px 16px',
          backgroundColor: isOpen ? 'rgba(0, 128, 0, 0.8)' : 'rgba(0, 0, 0, 0.7)',
          border: '2px solid #32cd32',
          borderRadius: '8px',
          color: '#32cd32',
          fontSize: '12px',
          fontWeight: 'bold',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
      >
        {isOpen ? '✖ CLOSE' : '⬆ UPGRADES'}
      </button>

      {/* Upgrade Panel */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            bottom: '50px',
            left: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            border: '2px solid #32cd32',
            borderRadius: '8px',
            padding: '12px',
            minWidth: '280px',
            maxHeight: '60vh',
            overflowY: 'auto',
          }}
        >
          <div style={{ color: '#32cd32', fontSize: '14px', fontWeight: 'bold', marginBottom: '12px' }}>
            PLAYER UPGRADES
          </div>

          {/* Current Resources */}
          <div
            style={{
              display: 'flex',
              gap: '12px',
              marginBottom: '12px',
              padding: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '4px',
            }}
          >
            <span style={{ color: '#708090', fontSize: '11px' }}>Scrap: {resources.scrap}</span>
            <span style={{ color: '#32cd32', fontSize: '11px' }}>Polymer: {resources.polymer}</span>
          </div>

          {/* Upgrade List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {UPGRADE_CONFIGS.map((config) => {
              const currentLevel = upgradeLevels[config.id] || 0;
              const isMaxed = currentLevel >= config.maxLevel;
              const cost = calculateCost(config, currentLevel);
              const affordable = canAfford(cost);

              return (
                <div
                  key={config.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px',
                    backgroundColor: isMaxed
                      ? 'rgba(50, 205, 50, 0.2)'
                      : affordable
                      ? 'rgba(255, 255, 255, 0.05)'
                      : 'rgba(255, 0, 0, 0.1)',
                    borderRadius: '4px',
                    border: `1px solid ${isMaxed ? '#32cd32' : affordable ? '#555' : '#440000'}`,
                  }}
                >
                  {/* Icon */}
                  <div style={{ fontSize: '20px', width: '24px', textAlign: 'center' }}>{config.icon}</div>

                  {/* Info */}
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#fff', fontSize: '11px', fontWeight: 'bold' }}>
                      {config.name}
                      <span style={{ color: '#888', marginLeft: '8px' }}>
                        Lv.{currentLevel}/{config.maxLevel}
                      </span>
                    </div>
                    <div style={{ color: '#888', fontSize: '9px' }}>{config.description}</div>
                    {!isMaxed && (
                      <div style={{ color: '#666', fontSize: '9px', marginTop: '2px' }}>
                        Cost: <span style={{ color: affordable ? '#708090' : '#ff4444' }}>{cost.scrap}</span> Scrap,{' '}
                        <span style={{ color: affordable ? '#32cd32' : '#ff4444' }}>{cost.polymer}</span> Polymer
                      </div>
                    )}
                  </div>

                  {/* Buy Button */}
                  {!isMaxed ? (
                    <button
                      onClick={() => handleUpgrade(config)}
                      disabled={!affordable}
                      style={{
                        padding: '4px 12px',
                        backgroundColor: affordable ? 'rgba(50, 205, 50, 0.3)' : 'rgba(100, 100, 100, 0.3)',
                        border: `1px solid ${affordable ? '#32cd32' : '#555'}`,
                        borderRadius: '4px',
                        color: affordable ? '#32cd32' : '#555',
                        fontSize: '10px',
                        cursor: affordable ? 'pointer' : 'not-allowed',
                        transition: 'all 0.2s',
                      }}
                    >
                      BUY
                    </button>
                  ) : (
                    <div
                      style={{
                        padding: '4px 8px',
                        color: '#32cd32',
                        fontSize: '10px',
                        fontWeight: 'bold',
                      }}
                    >
                      MAX
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
