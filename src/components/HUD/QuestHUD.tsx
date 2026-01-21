import React, { useCallback } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { questManager } from '../../game/managers/QuestManager';

export const QuestHUD: React.FC = () => {
  const { currentQuest } = useGameStore();

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

  if (!currentQuest) return null;

  const progressPercent = currentQuest.target
    ? (currentQuest.progress ?? 0) / currentQuest.target * 100
    : 0;

  const isComplete = currentQuest.progress !== undefined &&
                     currentQuest.target !== undefined &&
                     currentQuest.progress >= currentQuest.target;

  return (
    <div
      onClick={handleQuestClick}
      style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        width: '220px',
        backgroundColor: isComplete ? 'rgba(68, 255, 68, 0.2)' : 'rgba(0, 0, 0, 0.7)',
        border: isComplete ? '2px solid #44ff44' : '2px solid rgba(136, 68, 255, 0.5)',
        borderRadius: '8px',
        padding: '12px',
        zIndex: 1000,
        cursor: isComplete ? 'pointer' : 'default',
        transition: 'all 0.3s ease',
        boxShadow: isComplete ? '0 0 15px rgba(68, 255, 68, 0.5)' : 'none',
      }}
    >
      {/* Quest title */}
      <div
        style={{
          color: isComplete ? '#44ff44' : '#8844ff',
          fontSize: '12px',
          fontWeight: 'bold',
          marginBottom: '4px',
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}
      >
        {isComplete ? 'Complete!' : 'Quest'}
      </div>

      {/* Quest name */}
      <div
        style={{
          color: '#fff',
          fontSize: '14px',
          fontWeight: 'bold',
          marginBottom: '6px',
        }}
      >
        {currentQuest.title}
      </div>

      {/* Quest description */}
      <div
        style={{
          color: '#ccc',
          fontSize: '11px',
          marginBottom: '8px',
          lineHeight: '1.3',
        }}
      >
        {currentQuest.description}
      </div>

      {/* Progress bar */}
      {currentQuest.target !== undefined && (
        <div>
          <div
            style={{
              height: '8px',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              borderRadius: '4px',
              overflow: 'hidden',
              border: '1px solid rgba(255, 255, 255, 0.2)',
            }}
          >
            <div
              style={{
                width: `${Math.min(progressPercent, 100)}%`,
                height: '100%',
                backgroundColor: isComplete ? '#44ff44' : '#8844ff',
                transition: 'width 0.3s ease-out',
              }}
            />
          </div>
          <div
            style={{
              color: '#aaa',
              fontSize: '10px',
              textAlign: 'right',
              marginTop: '4px',
            }}
          >
            {currentQuest.progress ?? 0}/{currentQuest.target}
          </div>
        </div>
      )}

      {/* Click hint for completed quests */}
      {isComplete && (
        <div
          style={{
            color: '#44ff44',
            fontSize: '10px',
            textAlign: 'center',
            marginTop: '6px',
            animation: 'pulse 1s infinite',
          }}
        >
          Click to claim rewards!
        </div>
      )}

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
