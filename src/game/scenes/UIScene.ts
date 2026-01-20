import Phaser from 'phaser';
import { gameEvents } from '../managers/EventManager';

export class UIScene extends Phaser.Scene {
  // Reference to main scene
  private mainScene: Phaser.Scene | null = null;

  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    // Get reference to MainScene
    this.mainScene = this.scene.get('MainScene');

    // Listen for damage numbers - pass to MainScene since it has proper camera
    gameEvents.on('combat:damage', (data) => this.showDamageNumber(data));
  }

  private showDamageNumber(data: {
    x: number;
    y: number;
    damage: number;
    isCritical?: boolean;
  }): void {
    // Create damage text in MainScene so it follows camera properly
    if (!this.mainScene) return;

    const text = this.mainScene.add.text(data.x, data.y - 10, `-${data.damage}`, {
      fontFamily: 'Arial',
      fontSize: data.isCritical ? '16px' : '12px',
      color: data.isCritical ? '#ffff00' : '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    });

    text.setOrigin(0.5);
    text.setDepth(150);

    // Animate floating up and fading
    this.mainScene.tweens.add({
      targets: text,
      y: data.y - 40,
      alpha: 0,
      duration: 800,
      ease: 'Power2',
      onComplete: () => {
        text.destroy();
      },
    });
  }
}
