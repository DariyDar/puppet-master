import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // No assets needed - LoadingScene draws progress bar programmatically
  }

  create(): void {
    // Transition to loading scene
    this.scene.start('LoadingScene');
  }
}
