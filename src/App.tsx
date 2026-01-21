import React, { useState, useCallback } from 'react';
import type Phaser from 'phaser';
import { PhaserGame } from './components/Game';
import { TopHUD, BottomHUD, WorkbenchPanel, DebugMenu, UpgradePanel, QuestHUD } from './components/HUD';
import { VirtualJoystick } from './components/Controls';
import './App.css';

const App: React.FC = () => {
  const [isGameReady, setIsGameReady] = useState(false);

  const handleGameReady = useCallback((game: Phaser.Game) => {
    // Listen for the main scene to be ready
    game.events.on('ready', () => {
      setIsGameReady(true);
    });

    // Also check if main scene is already running
    const mainScene = game.scene.getScene('MainScene');
    if (mainScene && mainScene.scene.isActive()) {
      setIsGameReady(true);
    }

    // Fallback: set ready after a short delay
    setTimeout(() => {
      setIsGameReady(true);
    }, 1000);
  }, []);

  return (
    <div className="game-container">
      {/* Phaser Game Canvas */}
      <PhaserGame onGameReady={handleGameReady} />

      {/* React UI Overlay */}
      {isGameReady && (
        <>
          <TopHUD />
          <BottomHUD />
          <QuestHUD />
          <WorkbenchPanel />
          <VirtualJoystick />
          <DebugMenu />
          <UpgradePanel />
        </>
      )}
    </div>
  );
};

export default App;
