import React, { useCallback } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { questManager } from '../../game/managers/QuestManager';

export const BottomHUD: React.FC = () => {
  const { armyCount, currentQuest } = useGameStore();

  const armyPercent = (armyCount.current / armyCount.max) * 100;

  const handleQuestClick = useCallback(() => {
    if (!currentQuest) return;

    // Check if quest is completed and can claim rewards
    const quest = questManager.getCurrentQuest();
    if (quest && quest.state === 'completed') {
      const rewards = questManager.claimRewards(quest.id);
      if (rewards) {
        // Apply rewards
        const store = useGameStore.getState();
        rewards.forEach((reward) => {
          switch (reward.type) {
            case 'scrap':
            case 'polymer':
            case 'gems':
            case 'souls':
              store.addToStorage(reward.type, reward.amount);
              break;
            case 'exp':
              store.addXp(reward.amount);
              break;
          }
        });
      }
    }
  }, [currentQuest]);

  const isQuestComplete = currentQuest?.progress !== undefined &&
                          currentQuest?.target !== undefined &&
                          currentQuest.progress >= currentQuest.target;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        pointerEvents: 'auto',
        zIndex: 1000,
      }}
    >
      {/* Current Quest */}
      {currentQuest && (
        <div
          onClick={handleQuestClick}
          style={{
            backgroundColor: isQuestComplete ? 'rgba(68, 255, 68, 0.2)' : 'rgba(0, 0, 0, 0.7)',
            padding: '8px 12px',
            borderRadius: '8px',
            border: isQuestComplete ? '2px solid #44ff44' : '2px solid rgba(255, 215, 0, 0.5)',
            maxWidth: '250px',
            cursor: isQuestComplete ? 'pointer' : 'default',
            boxShadow: isQuestComplete ? '0 0 15px rgba(68, 255, 68, 0.5)' : 'none',
            transition: 'all 0.3s ease',
          }}
        >
          <div style={{ color: isQuestComplete ? '#44ff44' : '#ffd700', fontSize: '10px', fontWeight: 'bold' }}>
            {isQuestComplete ? 'COMPLETE!' : 'QUEST'}
          </div>
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
                  backgroundColor: isQuestComplete ? '#44ff44' : '#ffd700',
                  transition: 'width 0.3s ease-out',
                }}
              />
            </div>
          )}
          {isQuestComplete && (
            <div
              style={{
                color: '#44ff44',
                fontSize: '9px',
                textAlign: 'center',
                marginTop: '4px',
                animation: 'pulse 1s infinite',
              }}
            >
              Tap to claim!
            </div>
          )}
        </div>
      )}

      {/* Army Count */}
      <div
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          padding: '8px 12px',
          borderRadius: '8px',
          border: '2px solid rgba(138, 43, 226, 0.5)',
          pointerEvents: 'none',
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

      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}
      </style>
    </div>
  );
};
