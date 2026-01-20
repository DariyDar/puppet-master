import React from 'react';
import { useGameStore } from '../../stores/gameStore';

export const TopHUD: React.FC = () => {
  const { playerStats, resources } = useGameStore();

  const hpPercent = (playerStats.currentHp / playerStats.maxHp) * 100;
  const xpPercent = (playerStats.currentXp / playerStats.xpToNextLevel) * 100;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        padding: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        pointerEvents: 'none',
        zIndex: 1000,
      }}
    >
      {/* HP Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span style={{ color: '#ff4444', fontSize: '14px', fontWeight: 'bold' }}>HP</span>
        <div
          style={{
            flex: 1,
            maxWidth: '200px',
            height: '16px',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            borderRadius: '8px',
            overflow: 'hidden',
            border: '2px solid rgba(255, 255, 255, 0.3)',
          }}
        >
          <div
            style={{
              width: `${hpPercent}%`,
              height: '100%',
              backgroundColor: hpPercent > 50 ? '#44ff44' : hpPercent > 25 ? '#ffff44' : '#ff4444',
              transition: 'width 0.3s ease-out',
            }}
          />
        </div>
        <span style={{ color: '#fff', fontSize: '12px' }}>
          {playerStats.currentHp}/{playerStats.maxHp}
        </span>
      </div>

      {/* XP Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span style={{ color: '#44aaff', fontSize: '14px', fontWeight: 'bold' }}>
          Lv.{playerStats.level}
        </span>
        <div
          style={{
            flex: 1,
            maxWidth: '200px',
            height: '12px',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            borderRadius: '6px',
            overflow: 'hidden',
            border: '2px solid rgba(255, 255, 255, 0.3)',
          }}
        >
          <div
            style={{
              width: `${xpPercent}%`,
              height: '100%',
              backgroundColor: '#44aaff',
              transition: 'width 0.3s ease-out',
            }}
          />
        </div>
        <span style={{ color: '#fff', fontSize: '10px' }}>
          {playerStats.currentXp}/{playerStats.xpToNextLevel}
        </span>
      </div>

      {/* Resources */}
      <div
        style={{
          display: 'flex',
          gap: '16px',
          marginTop: '4px',
        }}
      >
        <ResourceDisplay label="Scrap" value={resources.scrap} color="#888888" />
        <ResourceDisplay label="Polymer" value={resources.polymer} color="#44ff88" />
        <ResourceDisplay label="Gems" value={resources.gems} color="#ff44ff" />
        <ResourceDisplay label="Souls" value={resources.souls} color="#8844ff" />
      </div>
    </div>
  );
};

interface ResourceDisplayProps {
  label: string;
  value: number;
  color: string;
}

const ResourceDisplay: React.FC<ResourceDisplayProps> = ({ label, value, color }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      padding: '4px 8px',
      borderRadius: '4px',
      border: `1px solid ${color}`,
    }}
  >
    <div
      style={{
        width: '12px',
        height: '12px',
        borderRadius: '2px',
        backgroundColor: color,
      }}
    />
    <span style={{ color: '#fff', fontSize: '12px' }}>
      {label}: {value}
    </span>
  </div>
);
