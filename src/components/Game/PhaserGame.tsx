import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { phaserConfig } from '../../game/config/PhaserConfig';
import { setupStoreListeners, useGameStore } from '../../stores/gameStore';
import { questManager } from '../../game/managers/QuestManager';

interface PhaserGameProps {
  onGameReady?: (game: Phaser.Game) => void;
}

export const PhaserGame: React.FC<PhaserGameProps> = ({ onGameReady }) => {
  const gameRef = useRef<Phaser.Game | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current && !gameRef.current) {
      // Create game config with parent container
      const config: Phaser.Types.Core.GameConfig = {
        ...phaserConfig,
        parent: containerRef.current,
      };

      // Initialize Phaser game
      gameRef.current = new Phaser.Game(config);

      // Setup event listeners to sync Phaser events with Zustand store
      setupStoreListeners();

      // Initialize first quest in HUD
      const quest = questManager.getCurrentQuest();
      if (quest) {
        const progress = quest.objectives.reduce((sum, obj) => sum + obj.current, 0);
        const target = quest.objectives.reduce((sum, obj) => sum + obj.target, 0);
        useGameStore.getState().updateQuest({
          id: quest.id,
          title: quest.title,
          description: quest.objectives[0]?.description || quest.description,
          progress,
          target,
        });
      }

      if (onGameReady) {
        onGameReady(gameRef.current);
      }
    }

    // Cleanup on unmount
    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, [onGameReady]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'absolute',
        top: 0,
        left: 0,
      }}
    />
  );
};
