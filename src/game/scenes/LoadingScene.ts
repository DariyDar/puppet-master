import Phaser from 'phaser';

export class LoadingScene extends Phaser.Scene {
  private progressBar!: Phaser.GameObjects.Graphics;
  private progressBox!: Phaser.GameObjects.Graphics;
  private loadingText!: Phaser.GameObjects.Text;
  private percentText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'LoadingScene' });
  }

  create(): void {
    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;

    // Progress box (background)
    this.progressBox = this.add.graphics();
    this.progressBox.fillStyle(0x222222, 0.8);
    this.progressBox.fillRect(centerX - 160, centerY - 25, 320, 50);

    // Progress bar (fill)
    this.progressBar = this.add.graphics();

    // Loading text
    this.loadingText = this.add.text(centerX, centerY - 50, 'Loading...', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#ffffff',
    });
    this.loadingText.setOrigin(0.5);

    // Percent text
    this.percentText = this.add.text(centerX, centerY, '0%', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#ffffff',
    });
    this.percentText.setOrigin(0.5);

    // Register loading events
    this.load.on('progress', (value: number) => {
      this.updateProgress(value);
    });

    this.load.on('complete', () => {
      this.onLoadComplete();
    });

    // Start loading game assets
    this.loadGameAssets();
  }

  private updateProgress(value: number): void {
    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;

    this.progressBar.clear();
    this.progressBar.fillStyle(0x8b0000, 1); // Dark red
    this.progressBar.fillRect(centerX - 155, centerY - 20, 310 * value, 40);

    this.percentText.setText(`${Math.floor(value * 100)}%`);
  }

  private loadGameAssets(): void {
    // ========== PLACEHOLDER ASSETS ==========
    // These will be replaced with actual pixel art later

    // Create placeholder textures programmatically
    this.createPlaceholderTextures();

    // ========== SPIDER PLAYER SPRITESHEETS ==========
    // Each spritesheet is 1024x1280 with 4x5 grid = 20 frames, each frame 256x256
    const frameConfig = { frameWidth: 256, frameHeight: 256 };

    // Idle animations (4 directions)
    this.load.spritesheet('spider_idle_down', 'assets/sprites/spider/idle_down.png', frameConfig);
    this.load.spritesheet('spider_idle_up', 'assets/sprites/spider/idle_up.png', frameConfig);
    this.load.spritesheet('spider_idle_left', 'assets/sprites/spider/idle_left.png', frameConfig);
    this.load.spritesheet('spider_idle_right', 'assets/sprites/spider/idle_right.png', frameConfig);

    // Walk animations (4 directions)
    this.load.spritesheet('spider_walk_down', 'assets/sprites/spider/walk_down.png', frameConfig);
    this.load.spritesheet('spider_walk_up', 'assets/sprites/spider/walk_up.png', frameConfig);
    this.load.spritesheet('spider_walk_left', 'assets/sprites/spider/walk_left.png', frameConfig);
    this.load.spritesheet('spider_walk_right', 'assets/sprites/spider/walk_right.png', frameConfig);

    // Attack animations (4 directions)
    this.load.spritesheet('spider_attack_down', 'assets/sprites/spider/attack_down.png', frameConfig);
    this.load.spritesheet('spider_attack_up', 'assets/sprites/spider/attack_up.png', frameConfig);
    this.load.spritesheet('spider_attack_left', 'assets/sprites/spider/attack_left.png', frameConfig);
    this.load.spritesheet('spider_attack_right', 'assets/sprites/spider/attack_right.png', frameConfig);

    // Death animation
    this.load.spritesheet('spider_death', 'assets/sprites/spider/death.png', frameConfig);

    // ========== TILEMAPS ==========
    // Will be loaded when actual maps are created

    // ========== UI ==========
    // Will be created as React components

    // ========== AUDIO ==========
    // Optional - add later

    // Start the load
    this.load.start();
  }

  private createPlaceholderTextures(): void {
    const graphics = this.make.graphics({ x: 0, y: 0 });

    // ========== PLAYER (Babyface - spider with human head) ==========
    // Body (dark red spider body)
    graphics.fillStyle(0x8b0000);
    graphics.fillCircle(16, 18, 10);

    // 8 Spider legs
    graphics.lineStyle(2, 0x5c0000);
    // Left legs
    graphics.lineBetween(8, 14, 0, 6);
    graphics.lineBetween(6, 18, 0, 16);
    graphics.lineBetween(6, 22, 0, 28);
    graphics.lineBetween(8, 24, 2, 32);
    // Right legs
    graphics.lineBetween(24, 14, 32, 6);
    graphics.lineBetween(26, 18, 32, 16);
    graphics.lineBetween(26, 22, 32, 28);
    graphics.lineBetween(24, 24, 30, 32);

    // Human head (creepy baby face)
    graphics.fillStyle(0xffe4c4); // Skin color
    graphics.fillCircle(16, 8, 7);
    // Eyes (black, staring)
    graphics.fillStyle(0x000000);
    graphics.fillCircle(13, 7, 2);
    graphics.fillCircle(19, 7, 2);
    // Creepy smile
    graphics.lineStyle(1, 0x800000);
    graphics.beginPath();
    graphics.arc(16, 10, 4, 0.2, Math.PI - 0.2, false);
    graphics.strokePath();

    graphics.generateTexture('player_placeholder', 32, 32);
    graphics.clear();

    // ========== ENEMY (Park Security Guard) ==========
    // Body (green/brown uniform)
    graphics.fillStyle(0x556b2f); // Dark olive green
    graphics.fillRect(10, 12, 12, 16); // Torso

    // Head
    graphics.fillStyle(0xffdab9); // Peach skin
    graphics.fillCircle(16, 8, 6);

    // Hat (security cap)
    graphics.fillStyle(0x2f4f4f);
    graphics.fillRect(10, 2, 12, 4);
    graphics.fillRect(8, 5, 16, 2);

    // Arms
    graphics.fillStyle(0x556b2f);
    graphics.fillRect(6, 14, 4, 10);
    graphics.fillRect(22, 14, 4, 10);

    // Legs
    graphics.fillStyle(0x3c3c3c); // Dark pants
    graphics.fillRect(11, 28, 4, 4);
    graphics.fillRect(17, 28, 4, 4);

    // Weapon (baton)
    graphics.fillStyle(0x4a4a4a);
    graphics.fillRect(24, 16, 3, 12);

    graphics.generateTexture('enemy_placeholder', 32, 32);
    graphics.clear();

    // ========== UNIT (Creepy Animatronic) ==========
    // Body (purple/blue metallic)
    graphics.fillStyle(0x483d8b); // Dark slate blue
    graphics.fillRect(8, 10, 16, 18);

    // Head (boxy animatronic)
    graphics.fillStyle(0x6a5acd); // Slate blue
    graphics.fillRect(6, 2, 20, 12);

    // Glowing red eyes
    graphics.fillStyle(0xff0000);
    graphics.fillCircle(11, 7, 3);
    graphics.fillCircle(21, 7, 3);
    // Eye glow effect
    graphics.fillStyle(0xff6666);
    graphics.fillCircle(11, 7, 1);
    graphics.fillCircle(21, 7, 1);

    // Mouth (teeth/grill)
    graphics.fillStyle(0x2f2f2f);
    graphics.fillRect(10, 10, 12, 3);
    graphics.lineStyle(1, 0xc0c0c0);
    graphics.lineBetween(12, 10, 12, 13);
    graphics.lineBetween(16, 10, 16, 13);
    graphics.lineBetween(20, 10, 20, 13);

    // Arms (mechanical)
    graphics.fillStyle(0x483d8b);
    graphics.fillRect(4, 12, 4, 12);
    graphics.fillRect(24, 12, 4, 12);
    // Joints
    graphics.fillStyle(0x808080);
    graphics.fillCircle(6, 18, 2);
    graphics.fillCircle(26, 18, 2);

    // Legs
    graphics.fillStyle(0x483d8b);
    graphics.fillRect(10, 28, 4, 4);
    graphics.fillRect(18, 28, 4, 4);

    graphics.generateTexture('unit_placeholder', 32, 32);
    graphics.clear();

    // Resource placeholders
    // Scrap (16x16, gray metallic)
    graphics.fillStyle(0x708090);
    graphics.fillCircle(8, 8, 6);
    graphics.generateTexture('scrap_placeholder', 16, 16);
    graphics.clear();

    // Polymer (16x16, green)
    graphics.fillStyle(0x32cd32);
    graphics.fillCircle(8, 8, 6);
    graphics.generateTexture('polymer_placeholder', 16, 16);
    graphics.clear();

    // Gems (16x16, blue crystal)
    graphics.fillStyle(0x00bfff);
    graphics.beginPath();
    graphics.moveTo(8, 0);
    graphics.lineTo(14, 8);
    graphics.lineTo(8, 16);
    graphics.lineTo(2, 8);
    graphics.closePath();
    graphics.fill();
    graphics.generateTexture('gem_placeholder', 16, 16);
    graphics.clear();

    // Soul (16x16, white ghostly)
    graphics.fillStyle(0xffffff, 0.7);
    graphics.fillCircle(8, 8, 6);
    graphics.generateTexture('soul_placeholder', 16, 16);
    graphics.clear();

    // Building placeholders
    // Storage (64x64)
    graphics.fillStyle(0x8b4513);
    graphics.fillRect(0, 0, 64, 64);
    graphics.fillStyle(0xdaa520);
    graphics.fillRect(4, 4, 56, 56);
    graphics.generateTexture('storage_placeholder', 64, 64);
    graphics.clear();

    // Workbench (64x48)
    graphics.fillStyle(0x2f4f4f);
    graphics.fillRect(0, 0, 64, 48);
    graphics.fillStyle(0x778899);
    graphics.fillRect(8, 8, 48, 32);
    graphics.generateTexture('workbench_placeholder', 64, 48);
    graphics.clear();

    // Tile placeholders (32x32)
    // Ground
    graphics.fillStyle(0x228b22);
    graphics.fillRect(0, 0, 32, 32);
    graphics.generateTexture('ground_placeholder', 32, 32);
    graphics.clear();

    // Wall
    graphics.fillStyle(0x696969);
    graphics.fillRect(0, 0, 32, 32);
    graphics.generateTexture('wall_placeholder', 32, 32);
    graphics.clear();

    // Portal
    graphics.fillStyle(0x9400d3);
    graphics.fillRect(0, 0, 48, 64);
    graphics.fillStyle(0xe6e6fa, 0.5);
    graphics.fillRect(8, 8, 32, 48);
    graphics.generateTexture('portal_placeholder', 48, 64);
    graphics.clear();

    // Corpse
    graphics.fillStyle(0x4a4a4a);
    graphics.fillRect(0, 0, 32, 16);
    graphics.generateTexture('corpse_placeholder', 32, 16);
    graphics.clear();

    // Particle (8x8, simple dot for effects)
    graphics.fillStyle(0xffffff);
    graphics.fillCircle(4, 4, 4);
    graphics.generateTexture('particle_placeholder', 8, 8);
    graphics.clear();

    // Resource deposits (48x48)
    // Scrap pile (metal junk pile)
    graphics.fillStyle(0x505050);
    graphics.fillRect(4, 24, 40, 20);
    graphics.fillStyle(0x708090);
    graphics.fillRect(8, 16, 12, 16);
    graphics.fillRect(24, 12, 16, 20);
    graphics.fillRect(14, 20, 8, 12);
    graphics.fillStyle(0x8a8a8a);
    graphics.fillRect(12, 14, 6, 6);
    graphics.fillRect(28, 8, 8, 8);
    graphics.generateTexture('scrap_deposit_placeholder', 48, 48);
    graphics.clear();

    // Polymer node (green organic blob)
    graphics.fillStyle(0x1a5f1a);
    graphics.fillCircle(24, 28, 18);
    graphics.fillStyle(0x32cd32);
    graphics.fillCircle(20, 24, 10);
    graphics.fillCircle(30, 28, 8);
    graphics.fillStyle(0x50ff50);
    graphics.fillCircle(18, 22, 4);
    graphics.generateTexture('polymer_deposit_placeholder', 48, 48);
    graphics.clear();

    // Gem cluster (crystal formation)
    graphics.fillStyle(0x005f8f);
    graphics.beginPath();
    graphics.moveTo(24, 4);
    graphics.lineTo(32, 20);
    graphics.lineTo(24, 36);
    graphics.lineTo(16, 20);
    graphics.closePath();
    graphics.fill();
    graphics.fillStyle(0x00bfff);
    graphics.beginPath();
    graphics.moveTo(12, 16);
    graphics.lineTo(18, 28);
    graphics.lineTo(12, 40);
    graphics.lineTo(6, 28);
    graphics.closePath();
    graphics.fill();
    graphics.beginPath();
    graphics.moveTo(36, 20);
    graphics.lineTo(42, 32);
    graphics.lineTo(36, 44);
    graphics.lineTo(30, 32);
    graphics.closePath();
    graphics.fill();
    graphics.generateTexture('gem_deposit_placeholder', 48, 48);
    graphics.clear();

    graphics.destroy();
  }

  private onLoadComplete(): void {
    // Clean up
    this.progressBar.destroy();
    this.progressBox.destroy();
    this.loadingText.destroy();
    this.percentText.destroy();

    // Start main game
    this.scene.start('MainScene');
    this.scene.start('UIScene');
  }
}
