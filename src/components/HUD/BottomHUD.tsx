import React from 'react';
import { useGameStore } from '../../stores/gameStore';

export const BottomHUD: React.FC = () => {
  const { cargo, armyCount, currentQuest } = useGameStore();

  const cargoPercent = (cargo.current / cargo.max) * 100;
  const armyPercent = (armyCount.current / armyCount.max) * 100;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        pointerEvents: 'none',
        zIndex: 1000,
      }}
    >
      {/* Current Quest */}
      {currentQuest && (
        <div
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            padding: '8px 12px',
            borderRadius: '8px',
            border: '2px solid rgba(255, 215, 0, 0.5)',
            maxWidth: '250px',
          }}
        >
          <div style={{ color: '#ffd700', fontSize: '10px', fontWeight: 'bold' }}>QUEST</div>
          <div style={{ color: '#fff', fontSize: '12px', marginTop: '4px' }}>
            {currentQuest.description}
          </div>
          {currentQuest.progress !== undefined && currentQuest.target !== undefined && (
            <div
              style={{
                marginTop: '6px',
                height: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '4px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${(currentQuest.progress / currentQuest.target) * 100}%`,
                  height: '100%',
                  backgroundColor: '#ffd700',
                  transition: 'width 0.3s ease-out',
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Cargo */}
      <div
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          padding: '8px 12px',
          borderRadius: '8px',
          border: '2px solid rgba(255, 165, 0, 0.5)',
          minWidth: '120px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '4px',
          }}
        >
          <span style={{ color: '#ffa500', fontSize: '12px', fontWeight: 'bold' }}>CARGO</span>
          <span style={{ color: '#fff', fontSize: '10px' }}>
            {cargo.current}/{cargo.max}
          </span>
        </div>
        <div
          style={{
            height: '8px',
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '4px',
            overflow: 'hidden',
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
        {/* Cargo breakdown */}
        {cargo.current > 0 && (
          <div
            style={{
              display: 'flex',
              gap: '8px',
              marginTop: '6px',
              fontSize: '10px',
            }}
          >
            {cargo.scrap > 0 && (
              <span style={{ color: '#888888' }}>
                <span style={{ display: 'inline-block', width: '8px', height: '8px', backgroundColor: '#708090', borderRadius: '50%', marginRight: '2px', verticalAlign: 'middle' }} />
                {cargo.scrap}
              </span>
            )}
            {cargo.polymer > 0 && (
              <span style={{ color: '#32cd32' }}>
                <span style={{ display: 'inline-block', width: '8px', height: '8px', backgroundColor: '#32cd32', borderRadius: '50%', marginRight: '2px', verticalAlign: 'middle' }} />
                {cargo.polymer}
              </span>
            )}
            {cargo.gems > 0 && (
              <span style={{ color: '#00bfff' }}>
                <span style={{ display: 'inline-block', width: '8px', height: '8px', backgroundColor: '#00bfff', transform: 'rotate(45deg)', marginRight: '2px', verticalAlign: 'middle' }} />
                {cargo.gems}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Army Count */}
      <div
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          padding: '8px 12px',
          borderRadius: '8px',
          border: '2px solid rgba(138, 43, 226, 0.5)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '4px',
          }}
        >
          <span style={{ color: '#8a2be2', fontSize: '12px', fontWeight: 'bold' }}>ARMY</span>
          <span style={{ color: '#fff', fontSize: '10px' }}>
            {armyCount.current}/{armyCount.max}
          </span>
        </div>
        <div
          style={{
            height: '8px',
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '4px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${armyPercent}%`,
              height: '100%',
              backgroundColor: armyPercent >= 100 ? '#ff4444' : '#8a2be2',
              transition: 'width 0.3s ease-out',
            }}
          />
        </div>
      </div>
    </div>
  );
};
