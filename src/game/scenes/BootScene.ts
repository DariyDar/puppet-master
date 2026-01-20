import Phaser from 'phaser';
import { getAssetPath } from '../config/PhaserConfig';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // Load minimal assets needed for loading screen
    // Loading bar background and fill
    this.load.image('loading_bar_bg', getAssetPath('assets/ui/loading_bar_bg.png'));
    this.load.image('loading_bar_fill', getAssetPath('assets/ui/loading_bar_fill.png'));
  }

  create(): void {
    // Transition to loading scene
    this.scene.start('LoadingScene');
  }
}
