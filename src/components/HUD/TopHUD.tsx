import React, { useState, useEffect } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { gameEvents } from '../../game/managers/EventManager';

export const TopHUD: React.FC = () => {
  const { playerStats, resources, cargo } = useGameStore();
  const [isLevelingUp, setIsLevelingUp] = useState(false);

  const hpPercent = (playerStats.currentHp / playerStats.maxHp) * 100;
  const xpPercent = (playerStats.currentXp / playerStats.xpToNextLevel) * 100;
  const cargoPercent = (cargo.current / cargo.max) * 100;

  // Purple color for XP (same as level up effect)
  const xpColor = '#8844ff';

  // Listen for level up visual event
  useEffect(() => {
    const handleLevelUpVisual = () => {
      setIsLevelingUp(true);
      setTimeout(() => setIsLevelingUp(false), 1000);
    };

    gameEvents.on('player:level-up-visual', handleLevelUpVisual);
    return () => {
      gameEvents.off('player:level-up-visual', handleLevelUpVisual);
    };
  }, []);

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
        gap: '6px',
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

      {/* XP Bar - Purple color */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span
          style={{
            color: xpColor,
            fontSize: '14px',
            fontWeight: 'bold',
            textShadow: isLevelingUp ? `0 0 10px ${xpColor}` : 'none',
            transition: 'text-shadow 0.3s ease',
          }}
        >
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
            border: `2px solid ${isLevelingUp ? xpColor : 'rgba(255, 255, 255, 0.3)'}`,
            boxShadow: isLevelingUp ? `0 0 15px ${xpColor}, inset 0 0 10px ${xpColor}` : 'none',
            transition: 'all 0.3s ease',
          }}
        >
          <div
            style={{
              width: `${xpPercent}%`,
              height: '100%',
              backgroundColor: xpColor,
              boxShadow: isLevelingUp ? `0 0 10px ${xpColor}` : 'none',
              transition: 'width 0.3s ease-out, box-shadow 0.3s ease',
            }}
          />
        </div>
        <span style={{ color: '#fff', fontSize: '10px' }}>
          {playerStats.currentXp}/{playerStats.xpToNextLevel}
        </span>
      </div>

      {/* Resources - renamed with icons */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          marginTop: '2px',
        }}
      >
        <ResourceDisplay label="Meat" value={resources.scrap} icon="🥩" color="#e07050" />
        <ResourceDisplay label="Wood" value={resources.polymer} icon="🪵" color="#8B4513" />
        <ResourceDisplay label="Gold" value={resources.gems} icon="🪙" color="#FFD700" />
        <ResourceDisplay label="Skull" value={resources.souls} icon="💀" color="#8844ff" />
      </div>

      {/* Cargo bar - small, under resources */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          maxWidth: '250px',
        }}
      >
        <span style={{ color: '#ffa500', fontSize: '10px', fontWeight: 'bold' }}>🎒</span>
        <div
          style={{
            flex: 1,
            height: '6px',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            borderRadius: '3px',
            overflow: 'hidden',
            border: '1px solid rgba(255, 165, 0, 0.5)',
          }}
        >
          <div
            style={{
              width: `${cargoPercent}%`,
              height: '100%',
              backgroundColor: cargoPercent >= 100 ? '#ff4444' : '#ffa500',
              transition: 'width 0.3s ease-out',
            }}
          />
        </div>
        <span style={{ color: '#fff', fontSize: '9px' }}>
          {cargo.current}/{cargo.max}
        </span>
      </div>
    </div>
  );
};

interface ResourceDisplayProps {
  label: string;
  value: number;
  icon: string;
  color: string;
}

const ResourceDisplay: React.FC<ResourceDisplayProps> = ({ label, value, icon, color }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      padding: '3px 6px',
      borderRadius: '4px',
      border: `1px solid ${color}`,
    }}
  >
    <span style={{ fontSize: '11px' }}>{icon}</span>
    <span style={{ color: '#fff', fontSize: '11px' }}>
      {value}
    </span>
  </div>
);
