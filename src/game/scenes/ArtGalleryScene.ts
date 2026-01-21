import Phaser from 'phaser';
import { ENEMY_CONFIGS, UNIT_CONFIGS, ATTACK_FRAME_RATE } from '../config/PhaserConfig';

/**
 * Debug scene to display all implemented art assets in a grid layout.
 * Helps visualize sprites and animations for feedback.
 *
 * Access by pressing 'G' in game or starting with ?gallery=true in URL
 */
export class ArtGalleryScene extends Phaser.Scene {
  private scrollY = 0;
  private rowHeight = 150;
  private colWidth = 140;
  private startY = 80;
  private startX = 50;
  private attackSpeedSliders: Map<string, { sprite: Phaser.GameObjects.Sprite; dust: Phaser.GameObjects.Sprite | null; speed: number; slider: Phaser.GameObjects.Container }> = new Map();

  constructor() {
    super({ key: 'ArtGalleryScene' });
  }

  create(): void {
    // Background
    this.cameras.main.setBackgroundColor(0x1a1a2e);

    // Title
    this.add.text(this.scale.width / 2, 30, 'ART GALLERY - Debug View', {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(this.scale.width / 2, 55, 'Scroll with mouse wheel | Press G or ESC to return to game', {
      fontSize: '12px',
      color: '#888888',
    }).setOrigin(0.5);

    // Create all animations first
    this.createAllAnimations();

    let currentRow = 0;

    // ========== ENEMIES ==========
    currentRow = this.addSectionTitle('ENEMIES', currentRow);

    for (const [enemyType, config] of Object.entries(ENEMY_CONFIGS)) {
      currentRow = this.addCharacterRowWithSlider(
        config.name,
        enemyType,
        config.sprites,
        currentRow,
        config.scale || 0.4,
        config.attackSpeed || 1
      );
    }

    // ========== PLAYER UNITS ==========
    currentRow = this.addSectionTitle('PLAYER UNITS', currentRow);

    for (const [unitType, config] of Object.entries(UNIT_CONFIGS)) {
      currentRow = this.addCharacterRowWithSlider(
        config.name,
        unitType,
        config.sprites,
        currentRow,
        config.scale || 0.4,
        config.attackSpeed || 1
      );
    }

    // ========== DECORATIONS ==========
    currentRow = this.addSectionTitle('DECORATIONS', currentRow);
    currentRow = this.addDecorationRow('Bushes', [
      { key: 'decor_bush1', name: 'Bush 1' },
      { key: 'decor_bush2', name: 'Bush 2' },
      { key: 'decor_bush3', name: 'Bush 3' },
      { key: 'decor_bush4', name: 'Bush 4' },
    ], currentRow, 0.4);
    currentRow = this.addDecorationRow('Trees', [
      { key: 'decor_tree1', name: 'Tree 1' },
      { key: 'decor_tree2', name: 'Tree 2' },
      { key: 'decor_tree3', name: 'Tree 3' },
      { key: 'decor_tree4', name: 'Tree 4' },
    ], currentRow, 0.25);
    currentRow = this.addDecorationRow('Rocks', [
      { key: 'decor_rock1', name: 'Rock 1' },
      { key: 'decor_rock2', name: 'Rock 2' },
      { key: 'decor_rock3', name: 'Rock 3' },
      { key: 'decor_rock4', name: 'Rock 4' },
    ], currentRow, 0.4);
    currentRow = this.addDecorationRow('Stumps', [
      { key: 'decor_stump1', name: 'Stump 1' },
      { key: 'decor_stump2', name: 'Stump 2' },
    ], currentRow, 0.4);
    currentRow = this.addDecorationRow('Clouds', [
      { key: 'decor_cloud1', name: 'Cloud 1' },
      { key: 'decor_cloud2', name: 'Cloud 2' },
      { key: 'decor_cloud3', name: 'Cloud 3' },
      { key: 'decor_cloud4', name: 'Cloud 4' },
    ], currentRow, 0.3);

    // ========== RESOURCES ==========
    currentRow = this.addSectionTitle('RESOURCES', currentRow);
    currentRow = this.addDecorationRow('Resource Pickups', [
      { key: 'resource_meat', name: 'Meat' },
      { key: 'resource_wood', name: 'Wood' },
      { key: 'resource_gold', name: 'Gold' },
    ], currentRow, 0.8);
    // Add dead knight corpse
    currentRow = this.addAnimatedResourceRow('Corpse (Dead Knight)', 'enemy_dead', 'enemy_dead_anim', currentRow, 0.6);

    // ========== EFFECTS ==========
    currentRow = this.addSectionTitle('EFFECTS', currentRow);
    currentRow = this.addEffectRow('Fire', 'effect_fire1', 'fire_anim', currentRow, 0.8);
    currentRow = this.addEffectRow('Explosion', 'effect_explosion1', 'explosion_anim', currentRow, 0.6);
    currentRow = this.addEffectRow('Dust', 'effect_dust1', 'dust_anim', currentRow, 0.8);

    // ========== BUILDINGS ==========
    currentRow = this.addSectionTitle('BUILDINGS', currentRow);
    currentRow = this.addDecorationRow('Red Buildings', [
      { key: 'building_red_tower', name: 'Tower' },
      { key: 'building_red_house1', name: 'House 1' },
      { key: 'building_red_house2', name: 'House 2' },
      { key: 'building_red_house3', name: 'House 3' },
    ], currentRow, 0.2);

    // ========== TERRAIN ==========
    currentRow = this.addSectionTitle('TERRAIN', currentRow);
    currentRow = this.addDecorationRow('Tilemaps', [
      { key: 'tilemap_zone1', name: 'Zone 1' },
      { key: 'tilemap_zone2', name: 'Zone 2' },
    ], currentRow, 0.3);

    // Enable scroll
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: Phaser.GameObjects.GameObject[], _deltaX: number, deltaY: number) => {
      this.scrollY += deltaY * 0.5;
      this.scrollY = Phaser.Math.Clamp(this.scrollY, 0, Math.max(0, currentRow * this.rowHeight - this.scale.height + 200));
      this.cameras.main.setScroll(0, this.scrollY);
    });

    // Return to game on G or ESC
    this.input.keyboard?.on('keydown-G', () => {
      this.returnToGame();
    });
    this.input.keyboard?.on('keydown-ESC', () => {
      this.returnToGame();
    });
  }

  private createAllAnimations(): void {
    // Create enemy animations
    for (const [enemyType, config] of Object.entries(ENEMY_CONFIGS)) {
      this.createAnimationsForEntity(enemyType, config.sprites);
    }

    // Create unit animations
    for (const [unitType, config] of Object.entries(UNIT_CONFIGS)) {
      this.createAnimationsForEntity(unitType, config.sprites);
    }

    // Create effect animations
    this.createEffectAnimation('effect_fire1', 'fire_anim', 10, -1);
    this.createEffectAnimation('effect_explosion1', 'explosion_anim', 15, 0);
    this.createEffectAnimation('effect_dust1', 'dust_anim', 15, 0); // faster for impact effect
    this.createEffectAnimation('enemy_dead', 'enemy_dead_anim', 8, -1);
  }

  private createAnimationsForEntity(
    type: string,
    sprites: { idle?: string; run?: string; attack?: string; walk?: string }
  ): void {
    const IDLE_FRAME_RATE = 6;
    const RUN_FRAME_RATE = 8;

    // Idle
    const idleKey = `${type}_idle`;
    if (!this.anims.exists(idleKey) && sprites.idle && this.textures.exists(sprites.idle)) {
      const texture = this.textures.get(sprites.idle);
      const frameCount = Math.max(1, texture.frameTotal - 1);
      this.anims.create({
        key: idleKey,
        frames: this.anims.generateFrameNumbers(sprites.idle, { start: 0, end: Math.max(0, frameCount - 1) }),
        frameRate: IDLE_FRAME_RATE,
        repeat: -1
      });
    }

    // Run/Walk
    const runSprite = sprites.run || sprites.walk;
    const runKey = `${type}_run`;
    if (!this.anims.exists(runKey) && runSprite && this.textures.exists(runSprite)) {
      const texture = this.textures.get(runSprite);
      const frameCount = Math.max(1, texture.frameTotal - 1);
      this.anims.create({
        key: runKey,
        frames: this.anims.generateFrameNumbers(runSprite, { start: 0, end: Math.max(0, frameCount - 1) }),
        frameRate: RUN_FRAME_RATE,
        repeat: -1
      });
    }

    // Attack - uses ATTACK_FRAME_RATE from config so timing matches attackSpeed
    const attackKey = `${type}_attack`;
    if (!this.anims.exists(attackKey) && sprites.attack && this.textures.exists(sprites.attack)) {
      const texture = this.textures.get(sprites.attack);
      const frameCount = Math.max(1, texture.frameTotal - 1);
      this.anims.create({
        key: attackKey,
        frames: this.anims.generateFrameNumbers(sprites.attack, { start: 0, end: Math.max(0, frameCount - 1) }),
        frameRate: ATTACK_FRAME_RATE,
        repeat: -1 // Loop for preview
      });
    }
  }

  private createEffectAnimation(textureKey: string, animKey: string, frameRate: number, repeat: number): void {
    if (!this.anims.exists(animKey) && this.textures.exists(textureKey)) {
      const texture = this.textures.get(textureKey);
      const frameCount = Math.max(1, texture.frameTotal - 1);
      this.anims.create({
        key: animKey,
        frames: this.anims.generateFrameNumbers(textureKey, { start: 0, end: Math.max(0, frameCount - 1) }),
        frameRate: frameRate,
        repeat: repeat
      });
    }
  }

  private returnToGame(): void {
    this.scene.stop('ArtGalleryScene');
    this.scene.resume('MainScene');
    this.scene.resume('UIScene');
  }

  private addSectionTitle(title: string, row: number): number {
    const y = this.startY + row * this.rowHeight;

    this.add.rectangle(this.scale.width / 2, y, this.scale.width - 40, 40, 0x333355);
    this.add.text(this.startX, y, title, {
      fontSize: '18px',
      color: '#ffcc00',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);

    return row + 0.5;
  }

  private addCharacterRowWithSlider(
    name: string,
    type: string,
    sprites: { idle?: string; run?: string; attack?: string; walk?: string },
    row: number,
    scale: number,
    attackSpeed: number = 1 // attacks per second
  ): number {
    const y = this.startY + row * this.rowHeight;
    let col = 0;

    // Row label
    this.add.text(this.startX, y, name, {
      fontSize: '14px',
      color: '#ffffff',
    }).setOrigin(0, 0.5);

    const labelWidth = 100;

    // Idle
    if (sprites.idle && this.textures.exists(sprites.idle)) {
      const x = this.startX + labelWidth + col * this.colWidth;
      const sprite = this.add.sprite(x, y, sprites.idle, 0);
      sprite.setScale(scale);

      const animKey = `${type}_idle`;
      if (this.anims.exists(animKey)) {
        sprite.play({ key: animKey, repeat: -1 });
      }

      this.add.text(x, y + 55, 'Idle', {
        fontSize: '10px',
        color: '#888888',
      }).setOrigin(0.5);
      col++;
    }

    // Run/Walk
    const runKey = sprites.run || sprites.walk;
    if (runKey && this.textures.exists(runKey)) {
      const x = this.startX + labelWidth + col * this.colWidth;
      const sprite = this.add.sprite(x, y, runKey, 0);
      sprite.setScale(scale);

      const animKey = `${type}_run`;
      if (this.anims.exists(animKey)) {
        sprite.play({ key: animKey, repeat: -1 });
      }

      this.add.text(x, y + 55, 'Run', {
        fontSize: '10px',
        color: '#888888',
      }).setOrigin(0.5);
      col++;
    }

    // Attack with speed slider
    if (sprites.attack && this.textures.exists(sprites.attack)) {
      const x = this.startX + labelWidth + col * this.colWidth;
      const attackSprite = this.add.sprite(x, y, sprites.attack, 0);
      attackSprite.setScale(scale);

      const animKey = `${type}_attack`;
      if (this.anims.exists(animKey)) {
        // Force play with repeat config
        attackSprite.play({ key: animKey, repeat: -1 });
      } else {
        // Animation doesn't exist, create it inline
        const texture = this.textures.get(sprites.attack);
        const frameCount = Math.max(1, texture.frameTotal - 1);
        if (frameCount > 0) {
          this.anims.create({
            key: animKey,
            frames: this.anims.generateFrameNumbers(sprites.attack, { start: 0, end: frameCount - 1 }),
            frameRate: 8,
            repeat: -1
          });
          attackSprite.play({ key: animKey, repeat: -1 });
        }
      }

      // Dust effect next to attack (shows attack timing) - positioned more to the right
      let dustSprite: Phaser.GameObjects.Sprite | null = null;
      if (this.textures.exists('effect_dust1')) {
        dustSprite = this.add.sprite(x + 80, y, 'effect_dust1', 0);
        dustSprite.setScale(0.6);
        dustSprite.setAlpha(0);
      }

      this.add.text(x, y + 55, 'Attack', {
        fontSize: '10px',
        color: '#888888',
      }).setOrigin(0.5);

      // Speed slider (0-10) with real attack timing
      const slider = this.createSpeedSlider(x, y + 70, type, attackSprite, dustSprite, attackSpeed);
      this.attackSpeedSliders.set(type, { sprite: attackSprite, dust: dustSprite, speed: 5, slider });

      col++;
    }

    return row + 1;
  }

  private createSpeedSlider(
    x: number,
    y: number,
    _type: string,
    attackSprite: Phaser.GameObjects.Sprite,
    dustSprite: Phaser.GameObjects.Sprite | null,
    attackSpeed: number // Real attack speed from config (attacks per second)
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    // Show attack speed info
    const attackDuration = 1000 / attackSpeed;
    const infoLabel = this.add.text(0, 0, `${attackSpeed.toFixed(2)}/s (${attackDuration.toFixed(0)}ms)`, {
      fontSize: '9px',
      color: '#88ff88'
    }).setOrigin(0.5);
    container.add(infoLabel);

    // Dust effect triggers on animationrepeat (last frame of animation = hit moment)
    // Since attackSpeed = ATTACK_FRAME_RATE / frameCount, animation end = attack moment
    if (dustSprite) {
      const showDust = () => {
        dustSprite.setAlpha(1);
        dustSprite.setTint(0xff4444); // Red tint for hit
        if (this.anims.exists('dust_anim')) {
          dustSprite.play('dust_anim');
          dustSprite.once('animationcomplete', () => {
            dustSprite.setAlpha(0);
            dustSprite.clearTint();
          });
        } else {
          this.time.delayedCall(150, () => {
            dustSprite.setAlpha(0);
            dustSprite.clearTint();
          });
        }
      };

      // Fire dust when animation loops (= hit moment, end of attack cycle)
      attackSprite.on('animationrepeat', showDust);
    }

    return container;
  }

  private addDecorationRow(
    name: string,
    items: { key: string; name: string }[],
    row: number,
    scale: number
  ): number {
    const y = this.startY + row * this.rowHeight;

    // Row label
    this.add.text(this.startX, y, name, {
      fontSize: '14px',
      color: '#ffffff',
    }).setOrigin(0, 0.5);

    const labelWidth = 120;
    let col = 0;

    for (const item of items) {
      if (this.textures.exists(item.key)) {
        const x = this.startX + labelWidth + col * this.colWidth;
        const img = this.add.image(x, y, item.key);
        img.setScale(scale);

        this.add.text(x, y + 55, item.name, {
          fontSize: '9px',
          color: '#666666',
        }).setOrigin(0.5);
        col++;
      }
    }

    return row + 1;
  }

  private addEffectRow(
    name: string,
    textureKey: string,
    animKey: string,
    row: number,
    scale: number
  ): number {
    const y = this.startY + row * this.rowHeight;

    // Row label
    this.add.text(this.startX, y, name, {
      fontSize: '14px',
      color: '#ffffff',
    }).setOrigin(0, 0.5);

    const labelWidth = 120;

    if (this.textures.exists(textureKey)) {
      const x = this.startX + labelWidth;
      const sprite = this.add.sprite(x, y, textureKey, 0);
      sprite.setScale(scale);

      if (this.anims.exists(animKey)) {
        // Fire loops infinitely, others replay with delay
        if (animKey === 'fire_anim') {
          sprite.play({ key: animKey, repeat: -1 });
        } else {
          // Play once, then replay after delay
          const playWithDelay = () => {
            sprite.play(animKey);
          };
          sprite.on('animationcomplete', () => {
            this.time.delayedCall(500, () => {
              if (sprite.active) {
                playWithDelay();
              }
            });
          });
          playWithDelay();
        }
      }

      this.add.text(x, y + 55, animKey, {
        fontSize: '9px',
        color: '#666666',
      }).setOrigin(0.5);
    }

    return row + 1;
  }

  private addAnimatedResourceRow(
    name: string,
    textureKey: string,
    animKey: string,
    row: number,
    scale: number
  ): number {
    const y = this.startY + row * this.rowHeight;

    // Row label
    this.add.text(this.startX, y, name, {
      fontSize: '14px',
      color: '#ffffff',
    }).setOrigin(0, 0.5);

    const labelWidth = 120;

    if (this.textures.exists(textureKey)) {
      const x = this.startX + labelWidth;
      const sprite = this.add.sprite(x, y, textureKey, 0);
      sprite.setScale(scale);

      if (this.anims.exists(animKey)) {
        sprite.play({ key: animKey, repeat: -1 });
      }

      this.add.text(x, y + 55, 'Dead Knight', {
        fontSize: '9px',
        color: '#666666',
      }).setOrigin(0.5);
    }

    return row + 1;
  }
}
