import Phaser from 'phaser';
import { GAME_CONFIG, UNIT_CONFIGS, ENEMY_CONFIGS, TOWER_CONFIGS, HOUSE_CONFIGS, FARM_CONFIGS } from '../config/PhaserConfig';
import type { EnemyType, EnemyBehavior, TowerType, HouseType, FarmType } from '../config/PhaserConfig';
import { gameEvents } from '../managers/EventManager';
import { questManager } from '../managers/QuestManager';
import { getSavedUpgrades, getSavedPlayerStats, getSavedArmyUnits, saveArmyUnits } from '../../stores/gameStore';
import type { SavedUnit } from '../../stores/gameStore';

type EnemyState = 'idle' | 'chase' | 'attack' | 'flee' | 'dead';
type UnitState = 'follow' | 'attack' | 'return' | 'dead';
type StructureState = 'active' | 'destroyed';

// 8 directions for player animations
type PlayerDirection = 'down' | 'down_right' | 'right' | 'up_right' | 'up' | 'up_left' | 'left' | 'down_left';

export class MainScene extends Phaser.Scene {
  // Map seed for consistent decoration placement
  private readonly MAP_SEED: number = 12345; // Fixed seed for consistent map
  private decorRng!: Phaser.Math.RandomDataGenerator;

  // Player
  private player!: Phaser.Physics.Arcade.Sprite;
  private playerShadow!: Phaser.GameObjects.Sprite;
  private playerSpeed: number = GAME_CONFIG.PLAYER_BASE_SPEED;
  private playerDamage: number = GAME_CONFIG.PLAYER_BASE_DAMAGE;
  private playerAttackRange: number = GAME_CONFIG.PLAYER_BASE_ATTACK_RANGE;
  private playerAttackSpeed: number = GAME_CONFIG.PLAYER_BASE_ATTACK_SPEED;
  private lastPlayerAttackTime: number = 0;
  private playerDirection: PlayerDirection = 'down';
  private isPlayerAttacking: boolean = false;
  private isPlayerDraining: boolean = false;

  // Input
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };

  // Joystick input from React
  private joystickDirection: { x: number; y: number } = { x: 0, y: 0 };
  private joystickForce: number = 0;

  // Groups
  private enemies!: Phaser.Physics.Arcade.Group;
  private units!: Phaser.Physics.Arcade.Group;
  private droppedResources!: Phaser.Physics.Arcade.Group;
  private corpses!: Phaser.Physics.Arcade.Group;
  private resourceDeposits!: Phaser.Physics.Arcade.Group;
  private decorColliders!: Phaser.Physics.Arcade.Group; // Trees and bushes with colliders
  private towers!: Phaser.Physics.Arcade.Group;
  private houses!: Phaser.Physics.Arcade.Group;

  // Structure tracking
  private towerIdCounter: number = 0;
  private houseIdCounter: number = 0;

  // Unit management
  private unitIdCounter: number = 0;
  private armySize: number = 0;
  private maxArmySize: number = GAME_CONFIG.ARMY_MAX_SIZE;

  // Buildings
  private storageBuilding!: Phaser.GameObjects.Sprite;
  private storageZone!: Phaser.GameObjects.Zone;
  private isInStorageRange: boolean = false;
  private lastBaseRegenTime: number = 0;
  private baseIndicatorArrow!: Phaser.GameObjects.Graphics;
  private workbenchBuilding!: Phaser.GameObjects.Sprite;
  private workbenchZone!: Phaser.GameObjects.Zone;
  private isInWorkbenchRange: boolean = false;

  // Farms (Recyclers)
  private farms: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private farmZones: Map<string, Phaser.GameObjects.Zone> = new Map();
  private farmIdCounter: number = 0;
  private lastFarmUpdate: number = 0;
  private isNearFarm: boolean = false;

  // Soul draining
  private isDrainingSoul: boolean = false;
  private currentDrainTarget: Phaser.Physics.Arcade.Sprite | null = null;
  private drainProgress: number = 0;
  private drainProgressBar: Phaser.GameObjects.Graphics | null = null;
  private soulDrainTime: number = GAME_CONFIG.PLAYER_BASE_SOUL_DRAIN_TIME * 1000; // ms

  // Map - much larger for exploration (3x bigger)
  private mapWidth: number = 6400;
  private mapHeight: number = 2400;

  // Zone boundaries
  private zone1End: number = 3200; // First zone ends here
  private zone2Start: number = 3200; // Second zone starts here

  // Base area (safe zone) - in zone 1, larger and more spacious
  private baseCenter = { x: 800, y: 800 };
  private baseRadius = 250; // 50% bigger base

  // Portals (one in each zone)
  private portal1!: Phaser.Physics.Arcade.Sprite; // Portal in Zone 1
  private portal2!: Phaser.Physics.Arcade.Sprite; // Portal in Zone 2
  private portal1UseText!: Phaser.GameObjects.Text;
  private portal2UseText!: Phaser.GameObjects.Text;
  private isNearPortal: boolean = false;
  private nearPortalId: number = 0; // Which portal player is near (1 or 2)

  // Spawn points
  private spawnPoints: { x: number; y: number; maxEnemies: number; currentEnemies: number; respawnTimer: number; enemyTypes?: EnemyType[] }[] = [];
  private lastSpawnCheck: number = 0;
  private enemyIdCounter: number = 0;

  // HP bars - stored directly on entities
  private hpBarsGraphics: Map<string, Phaser.GameObjects.Graphics> = new Map();

  // Deposit labels - to destroy when deposit is destroyed
  private depositLabels: Map<string, Phaser.GameObjects.Text> = new Map();

  constructor() {
    super({ key: 'MainScene' });
  }

  create(): void {
    // Initialize seeded RNG for consistent decoration placement
    this.decorRng = new Phaser.Math.RandomDataGenerator([this.MAP_SEED.toString()]);

    // Create spider player animations
    this.createPlayerAnimations();

    // Create effect animations (fire, dust, explosion)
    this.createEffectAnimations();

    // Create groups (MUST be before createTestMap which uses decorColliders)
    this.droppedResources = this.physics.add.group();
    this.corpses = this.physics.add.group();
    this.resourceDeposits = this.physics.add.group();
    this.enemies = this.physics.add.group({
      collideWorldBounds: true,
    });
    this.units = this.physics.add.group({
      collideWorldBounds: true,
    });
    this.towers = this.physics.add.group();
    this.houses = this.physics.add.group();
    this.decorColliders = this.physics.add.group();

    // Create simple test map
    this.createTestMap();

    // Create base buildings
    this.createBaseBuildings();

    // Create resource deposits
    this.createResourceDeposits();

    // Create enemy structures (towers and houses)
    this.createEnemyStructures();

    // Create player
    this.createPlayer();

    // Create test enemies
    this.createTestEnemies();

    // Setup camera
    this.setupCamera();

    // Setup input
    this.setupInput();

    // Setup collisions
    this.setupCollisions();

    // Listen for joystick events from React
    this.setupJoystickListener();

    // Load saved upgrades and apply them
    this.loadSavedProgress();

    // Emit scene ready event
    gameEvents.emit('scene:ready', { scene: 'MainScene' });
  }

  private loadSavedProgress(): void {
    // Apply saved upgrades
    const savedUpgrades = getSavedUpgrades();
    for (const [upgradeId, level] of Object.entries(savedUpgrades)) {
      if (level > 0) {
        this.applyUpgrade(upgradeId, level);
      }
    }

    // Apply saved player stats
    const savedStats = getSavedPlayerStats();
    this.player.setData('health', savedStats.currentHp);
    this.player.setData('maxHealth', savedStats.maxHp);

    // Emit initial health state
    gameEvents.emit('player:health-changed', {
      current: savedStats.currentHp,
      max: savedStats.maxHp,
    });

    // Load saved army units
    const savedArmy = getSavedArmyUnits();
    if (savedArmy && savedArmy.length > 0) {
      savedArmy.forEach((savedUnit: SavedUnit) => {
        this.spawnUnitFromSave(savedUnit);
      });
    }
  }

  private createPlayerAnimations(): void {
    const directions: PlayerDirection[] = ['down', 'down_right', 'right', 'up_right', 'up', 'up_left', 'left', 'down_left'];
    const frameRate = 12; // Animation speed

    // Create animations for each direction (body + shadow)
    directions.forEach((dir) => {
      // Idle body
      this.anims.create({
        key: `spider_idle_${dir}`,
        frames: this.anims.generateFrameNumbers(`spider_idle_${dir}`, { start: 0, end: 19 }),
        frameRate: frameRate,
        repeat: -1,
      });
      // Idle shadow
      this.anims.create({
        key: `spider_idle_shadow_${dir}`,
        frames: this.anims.generateFrameNumbers(`spider_idle_shadow_${dir}`, { start: 0, end: 19 }),
        frameRate: frameRate,
        repeat: -1,
      });

      // Walk body
      this.anims.create({
        key: `spider_walk_${dir}`,
        frames: this.anims.generateFrameNumbers(`spider_walk_${dir}`, { start: 0, end: 19 }),
        frameRate: frameRate,
        repeat: -1,
      });
      // Walk shadow
      this.anims.create({
        key: `spider_walk_shadow_${dir}`,
        frames: this.anims.generateFrameNumbers(`spider_walk_shadow_${dir}`, { start: 0, end: 19 }),
        frameRate: frameRate,
        repeat: -1,
      });

      // Attack body
      this.anims.create({
        key: `spider_attack_${dir}`,
        frames: this.anims.generateFrameNumbers(`spider_attack_${dir}`, { start: 0, end: 19 }),
        frameRate: frameRate * 2, // Attacks are 2x faster
        repeat: 0, // Don't loop
      });
      // Attack shadow
      this.anims.create({
        key: `spider_attack_shadow_${dir}`,
        frames: this.anims.generateFrameNumbers(`spider_attack_shadow_${dir}`, { start: 0, end: 19 }),
        frameRate: frameRate * 2,
        repeat: 0,
      });

      // Nervous (soul drain) body - only 16 frames (0-15)
      this.anims.create({
        key: `spider_nervous_${dir}`,
        frames: this.anims.generateFrameNumbers(`spider_nervous_${dir}`, { start: 0, end: 15 }),
        frameRate: frameRate,
        repeat: -1,
      });
      // Nervous shadow
      this.anims.create({
        key: `spider_nervous_shadow_${dir}`,
        frames: this.anims.generateFrameNumbers(`spider_nervous_shadow_${dir}`, { start: 0, end: 15 }),
        frameRate: frameRate,
        repeat: -1,
      });
    });

    // Create death animation (single direction)
    this.anims.create({
      key: 'spider_death',
      frames: this.anims.generateFrameNumbers('spider_death', { start: 0, end: 19 }),
      frameRate: frameRate,
      repeat: 0,
    });
    this.anims.create({
      key: 'spider_death_shadow',
      frames: this.anims.generateFrameNumbers('spider_death_shadow', { start: 0, end: 19 }),
      frameRate: frameRate,
      repeat: 0,
    });
  }

  private createEffectAnimations(): void {
    // Fire animations (64x64 frames) - for Monk projectile
    if (this.textures.exists('effect_fire1')) {
      const fireTexture = this.textures.get('effect_fire1');
      const fireFrameCount = fireTexture.frameTotal - 1;
      this.anims.create({
        key: 'fire_anim',
        frames: this.anims.generateFrameNumbers('effect_fire1', { start: 0, end: Math.max(0, fireFrameCount - 1) }),
        frameRate: 10,
        repeat: -1
      });
    }

    // Explosion animations (192x192 frames)
    if (this.textures.exists('effect_explosion1')) {
      const explosionTexture = this.textures.get('effect_explosion1');
      const explosionFrameCount = explosionTexture.frameTotal - 1;
      this.anims.create({
        key: 'explosion_anim',
        frames: this.anims.generateFrameNumbers('effect_explosion1', { start: 0, end: Math.max(0, explosionFrameCount - 1) }),
        frameRate: 12,
        repeat: 0
      });
    }

    // Dust animations (64x64 frames)
    if (this.textures.exists('effect_dust1')) {
      const dustTexture = this.textures.get('effect_dust1');
      const dustFrameCount = dustTexture.frameTotal - 1;
      this.anims.create({
        key: 'dust_anim',
        frames: this.anims.generateFrameNumbers('effect_dust1', { start: 0, end: Math.max(0, dustFrameCount - 1) }),
        frameRate: 10,
        repeat: 0
      });
    }

    // Water foam animation (192x192 frames, 16 frames)
    if (this.textures.exists('water_foam')) {
      const foamTexture = this.textures.get('water_foam');
      const foamFrameCount = Math.max(1, foamTexture.frameTotal - 1);
      this.anims.create({
        key: 'foam_anim',
        frames: this.anims.generateFrameNumbers('water_foam', { start: 0, end: Math.max(0, foamFrameCount - 1) }),
        frameRate: 8,
        repeat: -1
      });
    }

    // Sheep idle animation (128x128 frames, 6 frames)
    if (this.textures.exists('deposit_sheep')) {
      const sheepTexture = this.textures.get('deposit_sheep');
      const sheepFrameCount = sheepTexture.frameTotal - 1;
      this.anims.create({
        key: 'sheep_idle_anim',
        frames: this.anims.generateFrameNumbers('deposit_sheep', { start: 0, end: Math.max(0, sheepFrameCount - 1) }),
        frameRate: 6,
        repeat: -1
      });
    }

    // Sheep walk animation (128x128 frames)
    if (this.textures.exists('deposit_sheep_walk')) {
      const sheepWalkTexture = this.textures.get('deposit_sheep_walk');
      const sheepWalkFrameCount = sheepWalkTexture.frameTotal - 1;
      this.anims.create({
        key: 'sheep_walk_anim',
        frames: this.anims.generateFrameNumbers('deposit_sheep_walk', { start: 0, end: Math.max(0, sheepWalkFrameCount - 1) }),
        frameRate: 6,
        repeat: -1
      });
    }

    // Dead knight corpse animation (128x128 frames) - for enemy corpses
    if (this.textures.exists('enemy_dead')) {
      const deadTexture = this.textures.get('enemy_dead');
      const deadFrameCount = Math.max(1, deadTexture.frameTotal - 1);
      this.anims.create({
        key: 'enemy_dead_anim',
        frames: this.anims.generateFrameNumbers('enemy_dead', { start: 0, end: Math.max(0, deadFrameCount - 1) }),
        frameRate: 8,
        repeat: -1
      });
    }

    // Skull idle animation (192x192 frames) - for soul pickups
    if (this.textures.exists('skull_idle')) {
      const skullTexture = this.textures.get('skull_idle');
      const skullFrameCount = Math.max(1, skullTexture.frameTotal - 1);
      this.anims.create({
        key: 'skull_idle_anim',
        frames: this.anims.generateFrameNumbers('skull_idle', { start: 0, end: Math.max(0, skullFrameCount - 1) }),
        frameRate: 8,
        repeat: -1
      });
    }
  }

  private createTestMap(): void {
    // Simple solid color background for each zone
    // Zone 1: Forest green, Zone 2: Sandy yellow-green
    const zone1Color = 0x4a7c3f;
    const zone2Color = 0x7a8b4a;

    // Create background rectangles for each zone
    const zone1Bg = this.add.rectangle(
      this.zone1End / 2,
      this.mapHeight / 2,
      this.zone1End,
      this.mapHeight,
      zone1Color
    );
    zone1Bg.setDepth(-20);

    const zone2Bg = this.add.rectangle(
      this.zone1End + (this.mapWidth - this.zone1End) / 2,
      this.mapHeight / 2,
      this.mapWidth - this.zone1End,
      this.mapHeight,
      zone2Color
    );
    zone2Bg.setDepth(-20);

    // Add subtle texture variation using graphics
    const textureGraphics = this.add.graphics();
    textureGraphics.setDepth(-19);

    // Add random grass patches for visual interest
    for (let i = 0; i < 300; i++) {
      const x = Phaser.Math.Between(50, this.mapWidth - 50);
      const y = Phaser.Math.Between(50, this.mapHeight - 50);
      const isZone2 = x > this.zone1End;

      // Slightly different shade for variation
      const baseColor = isZone2 ? zone2Color : zone1Color;
      const variation = Phaser.Math.Between(-15, 15);
      const r = Math.min(255, Math.max(0, ((baseColor >> 16) & 0xff) + variation));
      const g = Math.min(255, Math.max(0, ((baseColor >> 8) & 0xff) + variation));
      const b = Math.min(255, Math.max(0, (baseColor & 0xff) + variation));
      const varColor = (r << 16) | (g << 8) | b;

      textureGraphics.fillStyle(varColor, 0.4);
      textureGraphics.fillCircle(x, y, Phaser.Math.Between(30, 80));
    }

    // Zone labels
    const zone1Label = this.add.text(640, 50, 'ZONE 1 - Starting Area', {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#4a9f4a',
      stroke: '#000000',
      strokeThickness: 2,
    });
    zone1Label.setOrigin(0.5);
    zone1Label.setDepth(1);
    zone1Label.setScrollFactor(0); // Fixed to camera

    const zone2Label = this.add.text(1920, 50, 'ZONE 2 - Danger Zone', {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#ff4444',
      stroke: '#000000',
      strokeThickness: 2,
    });
    zone2Label.setOrigin(0.5);
    zone2Label.setDepth(1);

    // Set world bounds (80px margin for water border)
    const margin = 80;
    this.physics.world.setBounds(margin, margin, this.mapWidth - margin * 2, this.mapHeight - margin * 2);

    // Add decorations
    this.createDecorations();

    // Create portal at edge of zone 1
    this.createPortal();
  }

  private createDecorations(): void {
    // Water border (water background only, no foam or rocks)
    this.createWaterBackground();

    // Decorations (trees, bushes, rocks, stumps, clouds, foam, water rocks) disabled
    // TODO: Re-enable when decoration system is properly designed
  }

  private createClouds(): void {
    // Use all 8 cloud types
    const cloudTypes = [
      'decor_cloud1', 'decor_cloud2', 'decor_cloud3', 'decor_cloud4',
      'decor_cloud5', 'decor_cloud6', 'decor_cloud7', 'decor_cloud8'
    ];

    // Check which cloud textures exist
    const availableClouds = cloudTypes.filter(type => this.textures.exists(type));
    if (availableClouds.length === 0) return;

    // Create 8-12 clouds that float across the map (use seeded RNG for initial positions)
    const cloudCount = 8 + this.decorRng.integerInRange(0, 4);

    for (let i = 0; i < cloudCount; i++) {
      const x = this.decorRng.integerInRange(-200, this.mapWidth + 200);
      const y = this.decorRng.integerInRange(100, this.mapHeight - 100);

      // Use different cloud types
      const cloudType = availableClouds[this.decorRng.integerInRange(0, availableClouds.length - 1)];
      const cloud = this.add.image(x, y, cloudType);
      cloud.setScale(0.5 + this.decorRng.frac() * 0.5);
      cloud.setAlpha(0.3 + this.decorRng.frac() * 0.3);
      cloud.setDepth(1000); // Above everything

      // Slow horizontal drift
      const speed = 10 + this.decorRng.frac() * 20;
      const direction = this.decorRng.frac() > 0.5 ? 1 : -1;

      this.tweens.add({
        targets: cloud,
        x: cloud.x + direction * (this.mapWidth + 400),
        duration: (this.mapWidth + 400) / speed * 1000,
        repeat: -1,
        onRepeat: () => {
          cloud.x = direction > 0 ? -200 : this.mapWidth + 200;
          cloud.y = Phaser.Math.Between(100, this.mapHeight - 100);
          // Change cloud type on repeat for variety
          const newType = availableClouds[Phaser.Math.Between(0, availableClouds.length - 1)];
          cloud.setTexture(newType);
        }
      });
    }
  }

  private createWaterBackground(): void {
    const waterMargin = 80; // Width of water border around island
    const tileSize = 64;
    const waterDepth = -15;

    // Create water background around the entire island perimeter (no foam or rocks)
    // Top water strip
    for (let x = -tileSize; x < this.mapWidth + tileSize; x += tileSize) {
      for (let y = -tileSize; y < waterMargin; y += tileSize) {
        if (this.textures.exists('water_background')) {
          const water = this.add.image(x, y, 'water_background');
          water.setDepth(waterDepth);
        }
      }
    }

    // Bottom water strip
    for (let x = -tileSize; x < this.mapWidth + tileSize; x += tileSize) {
      for (let y = this.mapHeight - waterMargin; y < this.mapHeight + tileSize; y += tileSize) {
        if (this.textures.exists('water_background')) {
          const water = this.add.image(x, y, 'water_background');
          water.setDepth(waterDepth);
        }
      }
    }

    // Left water strip
    for (let x = -tileSize; x < waterMargin; x += tileSize) {
      for (let y = waterMargin; y < this.mapHeight - waterMargin; y += tileSize) {
        if (this.textures.exists('water_background')) {
          const water = this.add.image(x, y, 'water_background');
          water.setDepth(waterDepth);
        }
      }
    }

    // Right water strip
    for (let x = this.mapWidth - waterMargin; x < this.mapWidth + tileSize; x += tileSize) {
      for (let y = waterMargin; y < this.mapHeight - waterMargin; y += tileSize) {
        if (this.textures.exists('water_background')) {
          const water = this.add.image(x, y, 'water_background');
          water.setDepth(waterDepth);
        }
      }
    }
  }

  private createWaterBorder(): void {
    const waterMargin = 80; // Width of water border around island
    const tileSize = 64;

    // Water depth should be above terrain (-20) but below everything else
    const waterDepth = -15;
    const foamDepth = -14;

    // Create water background around the entire island perimeter
    // This creates a frame of water around the playable area

    // Top water strip (full width)
    for (let x = -tileSize; x < this.mapWidth + tileSize; x += tileSize) {
      for (let y = -tileSize; y < waterMargin; y += tileSize) {
        if (this.textures.exists('water_background')) {
          const water = this.add.image(x, y, 'water_background');
          water.setDepth(waterDepth);
        }
      }
    }

    // Bottom water strip (full width)
    for (let x = -tileSize; x < this.mapWidth + tileSize; x += tileSize) {
      for (let y = this.mapHeight - waterMargin; y < this.mapHeight + tileSize; y += tileSize) {
        if (this.textures.exists('water_background')) {
          const water = this.add.image(x, y, 'water_background');
          water.setDepth(waterDepth);
        }
      }
    }

    // Left water strip
    for (let x = -tileSize; x < waterMargin; x += tileSize) {
      for (let y = waterMargin; y < this.mapHeight - waterMargin; y += tileSize) {
        if (this.textures.exists('water_background')) {
          const water = this.add.image(x, y, 'water_background');
          water.setDepth(waterDepth);
        }
      }
    }

    // Right water strip
    for (let x = this.mapWidth - waterMargin; x < this.mapWidth + tileSize; x += tileSize) {
      for (let y = waterMargin; y < this.mapHeight - waterMargin; y += tileSize) {
        if (this.textures.exists('water_background')) {
          const water = this.add.image(x, y, 'water_background');
          water.setDepth(waterDepth);
        }
      }
    }

    // Add animated foam along the shoreline (inner edge of water)
    // Create continuous foam line with overlapping sprites
    if (this.textures.exists('water_foam') && this.anims.exists('foam_anim')) {
      const foamScale = 0.4;
      // Foam texture is 192x192, scaled to ~77px. Spacing of 50 creates overlap
      const foamSpacing = 50;

      // Top foam line
      for (let x = waterMargin - 20; x < this.mapWidth - waterMargin + 20; x += foamSpacing) {
        const foam = this.add.sprite(x, waterMargin, 'water_foam');
        foam.setScale(foamScale);
        foam.setDepth(foamDepth);
        foam.setAlpha(0.85);
        foam.play('foam_anim');
      }

      // Bottom foam line
      for (let x = waterMargin - 20; x < this.mapWidth - waterMargin + 20; x += foamSpacing) {
        const foam = this.add.sprite(x, this.mapHeight - waterMargin, 'water_foam');
        foam.setScale(foamScale);
        foam.setDepth(foamDepth);
        foam.setAlpha(0.85);
        foam.setFlipY(true);
        foam.play('foam_anim');
      }

      // Left foam line
      for (let y = waterMargin - 20; y < this.mapHeight - waterMargin + 20; y += foamSpacing) {
        const foam = this.add.sprite(waterMargin, y, 'water_foam');
        foam.setScale(foamScale);
        foam.setDepth(foamDepth);
        foam.setAlpha(0.85);
        foam.setAngle(-90);
        foam.play('foam_anim');
      }

      // Right foam line
      for (let y = waterMargin - 20; y < this.mapHeight - waterMargin + 20; y += foamSpacing) {
        const foam = this.add.sprite(this.mapWidth - waterMargin, y, 'water_foam');
        foam.setScale(foamScale);
        foam.setDepth(foamDepth);
        foam.setAlpha(0.85);
        foam.setAngle(90);
        foam.play('foam_anim');
      }

      // Corner foam pieces for seamless connection
      // Top-left corner
      const tlFoam = this.add.sprite(waterMargin, waterMargin, 'water_foam');
      tlFoam.setScale(foamScale);
      tlFoam.setDepth(foamDepth);
      tlFoam.setAlpha(0.85);
      tlFoam.setAngle(-45);
      tlFoam.play('foam_anim');

      // Top-right corner
      const trFoam = this.add.sprite(this.mapWidth - waterMargin, waterMargin, 'water_foam');
      trFoam.setScale(foamScale);
      trFoam.setDepth(foamDepth);
      trFoam.setAlpha(0.85);
      trFoam.setAngle(45);
      trFoam.play('foam_anim');

      // Bottom-left corner
      const blFoam = this.add.sprite(waterMargin, this.mapHeight - waterMargin, 'water_foam');
      blFoam.setScale(foamScale);
      blFoam.setDepth(foamDepth);
      blFoam.setAlpha(0.85);
      blFoam.setAngle(-135);
      blFoam.play('foam_anim');

      // Bottom-right corner
      const brFoam = this.add.sprite(this.mapWidth - waterMargin, this.mapHeight - waterMargin, 'water_foam');
      brFoam.setScale(foamScale);
      brFoam.setDepth(foamDepth);
      brFoam.setAlpha(0.85);
      brFoam.setAngle(135);
      brFoam.play('foam_anim');
    }

    // Add water rocks scattered in the water border
    this.createWaterRocks(waterMargin, waterDepth);
  }

  private createWaterRocks(waterMargin: number, waterDepth: number): void {
    const waterRockTypes = ['water_rock1', 'water_rock2', 'water_rock3', 'water_rock4'];
    const availableRocks = waterRockTypes.filter(type => this.textures.exists(type));
    if (availableRocks.length === 0) return;

    // Place 15-25 water rocks around the water border
    const rockCount = 15 + this.decorRng.integerInRange(0, 10);

    for (let i = 0; i < rockCount; i++) {
      // Randomly choose a side (0: top, 1: bottom, 2: left, 3: right)
      const side = this.decorRng.integerInRange(0, 3);
      let x: number, y: number;

      switch (side) {
        case 0: // Top
          x = this.decorRng.integerInRange(20, this.mapWidth - 20);
          y = this.decorRng.integerInRange(10, waterMargin - 10);
          break;
        case 1: // Bottom
          x = this.decorRng.integerInRange(20, this.mapWidth - 20);
          y = this.decorRng.integerInRange(this.mapHeight - waterMargin + 10, this.mapHeight - 10);
          break;
        case 2: // Left
          x = this.decorRng.integerInRange(10, waterMargin - 10);
          y = this.decorRng.integerInRange(waterMargin, this.mapHeight - waterMargin);
          break;
        case 3: // Right
        default:
          x = this.decorRng.integerInRange(this.mapWidth - waterMargin + 10, this.mapWidth - 10);
          y = this.decorRng.integerInRange(waterMargin, this.mapHeight - waterMargin);
          break;
      }

      const rockType = availableRocks[this.decorRng.integerInRange(0, availableRocks.length - 1)];
      const rock = this.add.image(x, y, rockType);
      rock.setScale(0.3 + this.decorRng.frac() * 0.25);
      rock.setDepth(waterDepth + 1); // Just above water
      rock.setAlpha(0.95);

      // Add gentle bobbing animation (like floating)
      this.tweens.add({
        targets: rock,
        y: rock.y + 3,
        duration: 1500 + this.decorRng.integerInRange(0, 500),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: this.decorRng.integerInRange(0, 1500),
      });
    }
  }

  private placeRandomDecor(config: {
    zone: number;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    decorTypes: {
      bushes: string[];
      trees: string[];
      rocks: string[];
      stumps: string[];
    };
    transitionZoneStart?: number;
    transitionZoneEnd?: number;
  }): void {
    const { minX, maxX, minY, maxY, decorTypes, transitionZoneStart, transitionZoneEnd, zone } = config;

    // Exclude safe zones (base area for zone 1)
    const excludeZones = zone === 1 ? [
      { x: 800, y: 800, radius: 400 }, // Base area - larger exclusion
    ] : [];

    // Helper to check if position is valid
    const isValidPosition = (x: number, y: number): boolean => {
      for (const ez of excludeZones) {
        const dist = Phaser.Math.Distance.Between(x, y, ez.x, ez.y);
        if (dist < ez.radius) return false;
      }
      // Don't place in water margin
      if (x < 100 || x > this.mapWidth - 100 || y < 100 || y > this.mapHeight - 100) return false;
      return true;
    };

    // Use seeded RNG for consistent decoration placement
    // Bushes - 15-25 per zone
    const bushCount = 15 + this.decorRng.integerInRange(0, 10);
    for (let i = 0; i < bushCount; i++) {
      const x = minX + this.decorRng.frac() * (maxX - minX);
      const y = minY + this.decorRng.frac() * (maxY - minY);

      if (isValidPosition(x, y)) {
        const bushType = decorTypes.bushes[this.decorRng.integerInRange(0, decorTypes.bushes.length - 1)];
        if (this.textures.exists(bushType)) {
          const bush = this.add.image(x, y, bushType);
          bush.setScale(0.3 + this.decorRng.frac() * 0.2);
          bush.setDepth(y);

          // In transition zone, fade out
          if (transitionZoneStart && x > transitionZoneStart) {
            bush.setAlpha(1 - (x - transitionZoneStart) / 400);
          }
          if (transitionZoneEnd && x < transitionZoneEnd) {
            bush.setAlpha((x - minX) / 400);
          }

          // Add gentle swaying animation (wind effect)
          this.tweens.add({
            targets: bush,
            angle: { from: -2, to: 2 },
            duration: 2000 + this.decorRng.integerInRange(0, 1000),
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            delay: this.decorRng.integerInRange(0, 2000),
          });
        }
      }
    }

    // Trees - 20-35 per zone, scattered
    const treeCount = 20 + this.decorRng.integerInRange(0, 15);
    for (let i = 0; i < treeCount; i++) {
      const x = minX + this.decorRng.frac() * (maxX - minX);
      const y = minY + this.decorRng.frac() * (maxY - minY);

      if (isValidPosition(x, y)) {
        const treeType = decorTypes.trees[this.decorRng.integerInRange(0, decorTypes.trees.length - 1)];
        if (this.textures.exists(treeType)) {
          const treeScale = 0.35 + this.decorRng.frac() * 0.25;
          const tree = this.add.image(x, y, treeType);
          tree.setScale(treeScale);
          tree.setDepth(y);
          // Set origin to bottom for realistic swaying
          tree.setOrigin(0.5, 1);

          // Add gentle swaying animation (wind effect) - trees sway slower
          this.tweens.add({
            targets: tree,
            angle: { from: -1.5, to: 1.5 },
            duration: 3000 + this.decorRng.integerInRange(0, 1500),
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            delay: this.decorRng.integerInRange(0, 3000),
          });

          // Add small circular collider at tree base (trunk)
          const collider = this.physics.add.sprite(x, y, 'portal_placeholder');
          collider.setVisible(false);
          collider.setImmovable(true);
          const colliderBody = collider.body as Phaser.Physics.Arcade.Body;
          colliderBody.setCircle(12); // Small circular collider
          colliderBody.setOffset(-12, -12);
          colliderBody.setImmovable(true);
          colliderBody.moves = false;
          this.decorColliders.add(collider);
        }
      }
    }

    // Rocks - 12-20 per zone
    const rockCount = 12 + this.decorRng.integerInRange(0, 8);
    for (let i = 0; i < rockCount; i++) {
      const x = minX + this.decorRng.frac() * (maxX - minX);
      const y = minY + this.decorRng.frac() * (maxY - minY);

      if (isValidPosition(x, y)) {
        const rockType = decorTypes.rocks[this.decorRng.integerInRange(0, decorTypes.rocks.length - 1)];
        if (this.textures.exists(rockType)) {
          const rockScale = 0.25 + this.decorRng.frac() * 0.2;
          const rock = this.add.image(x, y, rockType);
          rock.setScale(rockScale);
          rock.setDepth(y - 10);

          // Add small circular collider for rocks
          const collider = this.physics.add.sprite(x, y, 'portal_placeholder');
          collider.setVisible(false);
          collider.setImmovable(true);
          const colliderBody = collider.body as Phaser.Physics.Arcade.Body;
          colliderBody.setCircle(8 * rockScale / 0.25); // Scale collider with rock size
          colliderBody.setOffset(-8 * rockScale / 0.25, -8 * rockScale / 0.25);
          colliderBody.setImmovable(true);
          colliderBody.moves = false;
          this.decorColliders.add(collider);
        }
      }
    }

    // Stumps - 8-15 per zone
    const stumpCount = 8 + this.decorRng.integerInRange(0, 7);
    for (let i = 0; i < stumpCount; i++) {
      const x = minX + this.decorRng.frac() * (maxX - minX);
      const y = minY + this.decorRng.frac() * (maxY - minY);

      if (isValidPosition(x, y)) {
        const stumpType = decorTypes.stumps[this.decorRng.integerInRange(0, decorTypes.stumps.length - 1)];
        if (this.textures.exists(stumpType)) {
          const stump = this.add.image(x, y, stumpType);
          stump.setScale(0.3 + this.decorRng.frac() * 0.15);
          stump.setDepth(y - 5);

          // Add small circular collider for stumps
          const collider = this.physics.add.sprite(x, y, 'portal_placeholder');
          collider.setVisible(false);
          collider.setImmovable(true);
          const colliderBody = collider.body as Phaser.Physics.Arcade.Body;
          colliderBody.setCircle(10);
          colliderBody.setOffset(-10, -10);
          colliderBody.setImmovable(true);
          colliderBody.moves = false;
          this.decorColliders.add(collider);
        }
      }
    }
  }

  private createPortal(): void {
    // Portal 1 - in Zone 1, leads to Zone 2
    const portal1X = this.zone1End - 100;
    const portal1Y = this.mapHeight / 2;
    this.createSinglePortal(portal1X, portal1Y, 1, 'PORTAL TO ZONE 2');

    // Portal 2 - in Zone 2, leads back to Zone 1
    const portal2X = this.zone2Start + 100;
    const portal2Y = this.mapHeight / 2;
    this.createSinglePortal(portal2X, portal2Y, 2, 'PORTAL TO BASE');
  }

  private createSinglePortal(x: number, y: number, portalId: number, labelText: string): void {
    const portal = this.physics.add.sprite(x, y, 'portal_placeholder');
    portal.setTint(portalId === 1 ? 0x9400d3 : 0x00ff88); // Purple for zone 2, green for base
    portal.setDepth(4);
    portal.setImmovable(true);
    portal.setData('portalId', portalId);

    const body = portal.body as Phaser.Physics.Arcade.Body;
    body.setImmovable(true);
    body.moves = false;

    // Portal zone for interaction
    const zone = this.add.zone(x, y, 80, 80);
    this.physics.add.existing(zone);
    (zone.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    (zone.body as Phaser.Physics.Arcade.Body).moves = false;
    zone.setData('portalId', portalId);

    // Portal glow effect
    const portalGlow = this.add.graphics();
    portalGlow.fillStyle(portalId === 1 ? 0x9400d3 : 0x00ff88, 0.3);
    portalGlow.fillCircle(x, y, 50);
    portalGlow.setDepth(3);

    // Animate portal glow
    this.tweens.add({
      targets: portalGlow,
      alpha: 0.1,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Portal label
    const portalLabel = this.add.text(x, y - 50, labelText, {
      fontFamily: 'Arial',
      fontSize: '10px',
      color: portalId === 1 ? '#cc66ff' : '#66ffaa',
      stroke: '#000000',
      strokeThickness: 2,
    });
    portalLabel.setOrigin(0.5);
    portalLabel.setDepth(5);

    // Instructions text (hidden initially)
    const useText = this.add.text(x, y + 50, '[SPACE] to teleport', {
      fontFamily: 'Arial',
      fontSize: '10px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    });
    useText.setOrigin(0.5);
    useText.setDepth(5);
    useText.setVisible(false);

    // Store references (zone is created but not stored - using distance check instead)
    void zone; // Avoid unused variable warning
    if (portalId === 1) {
      this.portal1 = portal;
      this.portal1UseText = useText;
    } else {
      this.portal2 = portal;
      this.portal2UseText = useText;
    }
  }

  private createBaseBuildings(): void {
    // Draw base zone (circle visual)
    const baseGraphics = this.add.graphics();
    baseGraphics.lineStyle(2, 0x4a9f4a, 0.5);
    baseGraphics.strokeCircle(this.baseCenter.x, this.baseCenter.y, this.baseRadius);
    baseGraphics.fillStyle(0x2a5f2a, 0.2);
    baseGraphics.fillCircle(this.baseCenter.x, this.baseCenter.y, this.baseRadius);
    baseGraphics.setDepth(0);

    // Create Storage building - centered near top of base
    this.storageBuilding = this.add.sprite(
      this.baseCenter.x,
      this.baseCenter.y - 100,
      'storage_placeholder'
    );
    this.storageBuilding.setDepth(4);
    this.storageBuilding.setData('type', 'storage');

    // Storage interaction zone
    this.storageZone = this.add.zone(
      this.storageBuilding.x,
      this.storageBuilding.y,
      GAME_CONFIG.STORAGE_COLLECT_RADIUS * 2,
      GAME_CONFIG.STORAGE_COLLECT_RADIUS * 2
    );
    this.physics.add.existing(this.storageZone);
    (this.storageZone.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    (this.storageZone.body as Phaser.Physics.Arcade.Body).moves = false;

    // Storage range indicator (subtle circle)
    const storageRangeGraphics = this.add.graphics();
    storageRangeGraphics.lineStyle(1, 0xdaa520, 0.3);
    storageRangeGraphics.strokeCircle(
      this.storageBuilding.x,
      this.storageBuilding.y,
      GAME_CONFIG.STORAGE_COLLECT_RADIUS
    );
    storageRangeGraphics.setDepth(1);

    // Add "STORAGE" label
    const storageLabel = this.add.text(
      this.storageBuilding.x,
      this.storageBuilding.y - 50,
      'STORAGE',
      {
        fontFamily: 'Arial',
        fontSize: '10px',
        color: '#daa520',
        stroke: '#000000',
        strokeThickness: 2,
      }
    );
    storageLabel.setOrigin(0.5);
    storageLabel.setDepth(4);

    // Create Workbench building - right side of base
    this.workbenchBuilding = this.add.sprite(
      this.baseCenter.x + 140,
      this.baseCenter.y + 40,
      'workbench_placeholder'
    );
    this.workbenchBuilding.setDepth(4);
    this.workbenchBuilding.setData('type', 'workbench');

    // Workbench interaction zone
    this.workbenchZone = this.add.zone(
      this.workbenchBuilding.x,
      this.workbenchBuilding.y,
      GAME_CONFIG.WORKBENCH_INTERACT_RADIUS * 2,
      GAME_CONFIG.WORKBENCH_INTERACT_RADIUS * 2
    );
    this.physics.add.existing(this.workbenchZone);
    (this.workbenchZone.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    (this.workbenchZone.body as Phaser.Physics.Arcade.Body).moves = false;

    // Workbench range indicator
    const workbenchRangeGraphics = this.add.graphics();
    workbenchRangeGraphics.lineStyle(1, 0x6a5acd, 0.3);
    workbenchRangeGraphics.strokeCircle(
      this.workbenchBuilding.x,
      this.workbenchBuilding.y,
      GAME_CONFIG.WORKBENCH_INTERACT_RADIUS
    );
    workbenchRangeGraphics.setDepth(1);

    // Add "WORKBENCH" label
    const workbenchLabel = this.add.text(
      this.workbenchBuilding.x,
      this.workbenchBuilding.y - 40,
      'WORKBENCH',
      {
        fontFamily: 'Arial',
        fontSize: '10px',
        color: '#6a5acd',
        stroke: '#000000',
        strokeThickness: 2,
      }
    );
    workbenchLabel.setOrigin(0.5);
    workbenchLabel.setDepth(4);

    // Create Farms (Recyclers) on base - spread around the perimeter
    this.createFarm(this.baseCenter.x - 140, this.baseCenter.y + 60, 'scrap_recycler');
    this.createFarm(this.baseCenter.x - 140, this.baseCenter.y - 60, 'polymer_recycler');
    this.createFarm(this.baseCenter.x + 140, this.baseCenter.y + 140, 'gem_refinery');

    // Create base direction indicator (arrow) - will be updated in update loop
    this.baseIndicatorArrow = this.add.graphics();
    this.baseIndicatorArrow.setDepth(1000); // Always on top
    this.baseIndicatorArrow.setScrollFactor(0); // Fixed to camera
  }

  private createFarm(x: number, y: number, farmType: FarmType): void {
    const config = FARM_CONFIGS[farmType];
    const farmId = `farm_${this.farmIdCounter++}`;

    // Create farm sprite (use a tinted workbench placeholder for now)
    const farm = this.add.sprite(x, y, 'workbench_placeholder');
    farm.setScale(0.6);
    farm.setDepth(4);

    // Color based on resource type
    const tintColors: Record<string, number> = {
      scrap: 0x708090, // Gray for scrap
      polymer: 0x32cd32, // Green for polymer
      gems: 0x00bfff, // Blue for gems
    };
    farm.setTint(tintColors[config.resourceType] || 0xffffff);

    // Set farm data
    farm.setData('type', 'farm');
    farm.setData('id', farmId);
    farm.setData('farmType', farmType);
    farm.setData('level', 1);
    farm.setData('storedResources', 0);
    farm.setData('lastProductionTime', this.time.now);

    // Calculate current stats based on level
    const level = 1;
    const productionRate = config.baseProductionRate * config.productionMultipliers[level - 1];
    const capacity = config.baseCapacity * config.capacityMultipliers[level - 1];

    farm.setData('productionRate', productionRate);
    farm.setData('capacity', capacity);

    // Farm interaction zone
    const zone = this.add.zone(x, y, GAME_CONFIG.FARM_INTERACT_RADIUS * 2, GAME_CONFIG.FARM_INTERACT_RADIUS * 2);
    this.physics.add.existing(zone);
    (zone.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    (zone.body as Phaser.Physics.Arcade.Body).moves = false;
    zone.setData('farmId', farmId);

    // Farm range indicator
    const farmRangeGraphics = this.add.graphics();
    farmRangeGraphics.lineStyle(1, tintColors[config.resourceType], 0.3);
    farmRangeGraphics.strokeCircle(x, y, GAME_CONFIG.FARM_INTERACT_RADIUS);
    farmRangeGraphics.setDepth(1);

    // Add label with name and resource type icon
    const farmLabel = this.add.text(x, y - 30, config.name, {
      fontFamily: 'Arial',
      fontSize: '9px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    });
    farmLabel.setOrigin(0.5);
    farmLabel.setDepth(4);

    // Add stored resources text (below the farm)
    const resourceText = this.add.text(x, y + 30, '0 / ' + capacity, {
      fontFamily: 'Arial',
      fontSize: '8px',
      color: '#aaffaa',
      stroke: '#000000',
      strokeThickness: 1,
    });
    resourceText.setOrigin(0.5);
    resourceText.setDepth(4);
    farm.setData('resourceText', resourceText);

    // Store references
    this.farms.set(farmId, farm);
    this.farmZones.set(farmId, zone);
  }

  private createResourceDeposits(): void {
    // Generate random deposit locations with some variance
    const addNoise = (base: number, range: number) => base + Phaser.Math.Between(-range, range);

    const depositData = [
      // ===== ZONE 1 (0-3200) =====
      // Scrap (sheep) - near base, randomized positions
      { x: addNoise(550, 80), y: addNoise(550, 80), type: 'scrap', health: 50, resourceAmount: 20 },
      { x: addNoise(1050, 100), y: addNoise(480, 80), type: 'scrap', health: 50, resourceAmount: 20 },
      { x: addNoise(480, 80), y: addNoise(1150, 100), type: 'scrap', health: 50, resourceAmount: 20 },
      { x: addNoise(1150, 100), y: addNoise(1080, 100), type: 'scrap', health: 50, resourceAmount: 20 },
      // Scrap further out
      { x: addNoise(1750, 120), y: addNoise(450, 100), type: 'scrap', health: 60, resourceAmount: 25 },
      { x: addNoise(2250, 120), y: addNoise(650, 120), type: 'scrap', health: 60, resourceAmount: 25 },
      { x: addNoise(1680, 120), y: addNoise(1550, 120), type: 'scrap', health: 60, resourceAmount: 25 },
      { x: addNoise(2350, 120), y: addNoise(1750, 100), type: 'scrap', health: 60, resourceAmount: 25 },
      // Polymer (trees) - Zone 1
      { x: addNoise(450, 100), y: addNoise(1750, 100), type: 'polymer', health: 80, resourceAmount: 12 },
      { x: addNoise(1550, 120), y: addNoise(350, 80), type: 'polymer', health: 80, resourceAmount: 12 },
      { x: addNoise(2550, 150), y: addNoise(1050, 150), type: 'polymer', health: 80, resourceAmount: 15 },
      { x: addNoise(2850, 120), y: addNoise(1650, 120), type: 'polymer', health: 80, resourceAmount: 15 },
      // Gem (gold mine) - Zone 1 edges
      { x: addNoise(250, 80), y: addNoise(1950, 80), type: 'gems', health: 120, resourceAmount: 5 },
      { x: addNoise(2950, 100), y: addNoise(450, 100), type: 'gems', health: 120, resourceAmount: 6 },

      // ===== ZONE 2 (3200-6400) =====
      // Scrap (sheep) - more valuable, random spread
      { x: addNoise(3650, 150), y: addNoise(550, 150), type: 'scrap', health: 70, resourceAmount: 30 },
      { x: addNoise(4250, 150), y: addNoise(750, 150), type: 'scrap', health: 70, resourceAmount: 30 },
      { x: addNoise(4850, 150), y: addNoise(450, 150), type: 'scrap', health: 70, resourceAmount: 30 },
      { x: addNoise(5350, 150), y: addNoise(850, 150), type: 'scrap', health: 70, resourceAmount: 30 },
      { x: addNoise(3700, 150), y: addNoise(1550, 150), type: 'scrap', health: 70, resourceAmount: 30 },
      { x: addNoise(4300, 150), y: addNoise(1750, 150), type: 'scrap', health: 70, resourceAmount: 30 },
      { x: addNoise(4750, 150), y: addNoise(1650, 150), type: 'scrap', health: 70, resourceAmount: 30 },
      { x: addNoise(5450, 150), y: addNoise(1850, 150), type: 'scrap', health: 70, resourceAmount: 30 },
      // Polymer (trees) - Zone 2, scattered
      { x: addNoise(3850, 180), y: addNoise(450, 150), type: 'polymer', health: 100, resourceAmount: 18 },
      { x: addNoise(4550, 180), y: addNoise(650, 180), type: 'polymer', health: 100, resourceAmount: 18 },
      { x: addNoise(5050, 180), y: addNoise(350, 150), type: 'polymer', health: 100, resourceAmount: 18 },
      { x: addNoise(3950, 180), y: addNoise(1350, 180), type: 'polymer', health: 100, resourceAmount: 18 },
      { x: addNoise(4450, 180), y: addNoise(1150, 180), type: 'polymer', health: 100, resourceAmount: 18 },
      { x: addNoise(5150, 180), y: addNoise(1450, 180), type: 'polymer', health: 100, resourceAmount: 18 },
      { x: addNoise(5650, 180), y: addNoise(1050, 180), type: 'polymer', health: 100, resourceAmount: 20 },
      // Gem (gold mine) - Zone 2
      { x: addNoise(3750, 150), y: addNoise(1050, 150), type: 'gems', health: 150, resourceAmount: 8 },
      { x: addNoise(4350, 150), y: addNoise(1150, 150), type: 'gems', health: 150, resourceAmount: 8 },
      { x: addNoise(4950, 150), y: addNoise(950, 150), type: 'gems', health: 150, resourceAmount: 8 },
      { x: addNoise(5550, 150), y: addNoise(1050, 150), type: 'gems', health: 150, resourceAmount: 10 },
      { x: addNoise(6050, 100), y: addNoise(650, 150), type: 'gems', health: 180, resourceAmount: 12 },
      { x: addNoise(6050, 100), y: addNoise(1250, 150), type: 'gems', health: 180, resourceAmount: 12 },
      { x: addNoise(6050, 100), y: addNoise(1850, 150), type: 'gems', health: 180, resourceAmount: 12 },
    ];

    depositData.forEach((data, index) => {
      // Map old resource types to new visual sprites
      // scrap → sheep (meat source), polymer → tree (wood source), gems → goldmine (gold source)
      let textureName: string;
      let depositScale = 0.5;

      switch (data.type) {
        case 'scrap':
          textureName = this.textures.exists('deposit_sheep') ? 'deposit_sheep' : 'scrap_deposit_placeholder';
          depositScale = 0.6;
          break;
        case 'polymer':
          // Use tree sprites for wood sources
          textureName = this.textures.exists('decor_tree1') ? 'decor_tree1' : 'polymer_deposit_placeholder';
          depositScale = 0.4;
          break;
        case 'gems':
          textureName = this.textures.exists('deposit_goldmine') ? 'deposit_goldmine' : 'gems_deposit_placeholder';
          depositScale = 0.4;
          break;
        default:
          textureName = `${data.type}_deposit_placeholder`;
      }

      const deposit = this.physics.add.sprite(data.x, data.y, textureName);
      deposit.setScale(depositScale);

      deposit.setData('type', 'deposit');
      deposit.setData('id', `deposit_${index}`);
      deposit.setData('resourceType', data.type);
      deposit.setData('health', data.health);
      deposit.setData('maxHealth', data.health);
      deposit.setData('resourceAmount', data.resourceAmount);
      deposit.setDepth(3);
      deposit.setImmovable(true);

      // Make deposit body static
      const body = deposit.body as Phaser.Physics.Arcade.Body;
      body.setImmovable(true);
      body.moves = false;

      // Special handling for sheep: smaller collider + idle animation
      if (data.type === 'scrap' && textureName === 'deposit_sheep') {
        // Sheep is small inside 128x128 frame - set smaller body
        body.setSize(40, 30);
        body.setOffset(44, 70);
        // Play idle animation
        if (this.anims.exists('sheep_idle_anim')) {
          deposit.play('sheep_idle_anim');
        }
      }

      // Special handling for gold mine: smaller collider at base
      if (data.type === 'gems' && textureName === 'deposit_goldmine') {
        // Gold mine has large top but smaller base - collider at bottom
        const texture = this.textures.get('deposit_goldmine');
        const frame = texture.get();
        const scaledWidth = frame.width * depositScale;
        const scaledHeight = frame.height * depositScale;
        // Set body to bottom-center area (entrance)
        body.setSize(scaledWidth * 0.4, scaledHeight * 0.3);
        body.setOffset(frame.width * 0.3, frame.height * 0.65);
      }

      this.resourceDeposits.add(deposit);

      // Create HP bar for deposit
      const depositId = `deposit_${index}`;
      this.createHpBar(depositId);

      // Add label above the deposit
      // Map old names to new visual names
      const labelMap: Record<string, string> = {
        scrap: 'SHEEP',
        polymer: 'TREE',
        gems: 'GOLD MINE',
      };
      const labelText = labelMap[data.type] || data.type.toUpperCase();
      const labelColor = this.getResourceColor(data.type);
      const label = this.add.text(data.x, data.y - 45, labelText, {
        fontFamily: 'Arial',
        fontSize: '9px',
        color: `#${labelColor.toString(16).padStart(6, '0')}`,
        stroke: '#000000',
        strokeThickness: 2,
      });
      label.setOrigin(0.5);
      label.setDepth(4);

      // Store label reference for cleanup
      this.depositLabels.set(depositId, label);
    });
  }

  private createEnemyStructures(): void {
    // Create watchtowers - map is 6400x2400, base at (800,800), zone split at 3200
    const towerPositions: { x: number; y: number; type: TowerType }[] = [
      // ZONE 1 - Starting area (basic towers) - near base perimeter
      { x: 1400, y: 500, type: 'watchtower_basic' },
      { x: 1400, y: 1100, type: 'watchtower_basic' },
      { x: 500, y: 1600, type: 'watchtower_basic' },
      { x: 1100, y: 1800, type: 'watchtower_basic' },
      // ZONE 1 - Further out (advanced towers)
      { x: 2000, y: 400, type: 'watchtower_advanced' },
      { x: 2600, y: 800, type: 'watchtower_advanced' },
      { x: 2000, y: 1600, type: 'watchtower_advanced' },
      { x: 2600, y: 2000, type: 'watchtower_advanced' },

      // ZONE 2 - Danger zone (advanced towers everywhere)
      { x: 3400, y: 600, type: 'watchtower_advanced' },
      { x: 4000, y: 400, type: 'watchtower_advanced' },
      { x: 4600, y: 600, type: 'watchtower_advanced' },
      { x: 5200, y: 400, type: 'watchtower_advanced' },
      { x: 3400, y: 1400, type: 'watchtower_advanced' },
      { x: 4000, y: 1200, type: 'watchtower_advanced' },
      { x: 4600, y: 1400, type: 'watchtower_advanced' },
      { x: 5200, y: 1200, type: 'watchtower_advanced' },
      { x: 3800, y: 2000, type: 'watchtower_advanced' },
      { x: 4400, y: 1800, type: 'watchtower_advanced' },
      { x: 5000, y: 2000, type: 'watchtower_advanced' },
      { x: 5600, y: 1800, type: 'watchtower_advanced' },
    ];

    towerPositions.forEach((pos) => {
      this.createTower(pos.x, pos.y, pos.type);
    });

    // Create enemy houses - spawn enemies when attacked
    const housePositions: { x: number; y: number; type: HouseType }[] = [
      // ZONE 1 - Starting area (small/medium houses)
      { x: 300, y: 300, type: 'house_small' },
      { x: 1300, y: 300, type: 'house_small' },
      { x: 300, y: 1400, type: 'house_small' },
      { x: 1600, y: 700, type: 'house_small' },
      { x: 2200, y: 500, type: 'house_medium' },
      { x: 2200, y: 1300, type: 'house_medium' },
      { x: 1600, y: 1900, type: 'house_medium' },
      { x: 2800, y: 600, type: 'house_medium' },
      { x: 2800, y: 1400, type: 'house_medium' },

      // ZONE 2 - Danger zone (medium/large houses)
      { x: 3500, y: 300, type: 'house_medium' },
      { x: 4100, y: 500, type: 'house_medium' },
      { x: 4700, y: 300, type: 'house_large' },
      { x: 5300, y: 500, type: 'house_large' },
      { x: 3500, y: 1100, type: 'house_medium' },
      { x: 4100, y: 900, type: 'house_large' },
      { x: 4700, y: 1100, type: 'house_large' },
      { x: 5300, y: 900, type: 'house_large' },
      { x: 3900, y: 1700, type: 'house_large' },
      { x: 4500, y: 1500, type: 'house_large' },
      { x: 5100, y: 1700, type: 'house_large' },
      { x: 5700, y: 1500, type: 'house_large' },
      // Far east - manor district
      { x: 5900, y: 800, type: 'house_large' },
      { x: 5900, y: 1400, type: 'house_large' },
      { x: 5900, y: 2000, type: 'house_large' },
    ];

    housePositions.forEach((pos) => {
      this.createHouse(pos.x, pos.y, pos.type);
    });
  }

  private createTower(x: number, y: number, towerType: TowerType): Phaser.Physics.Arcade.Sprite {
    const config = TOWER_CONFIGS[towerType];
    const towerId = `tower_${this.towerIdCounter++}`;

    // Create tower sprite using Tiny Swords building
    const tower = this.physics.add.sprite(x, y, 'building_red_tower');
    tower.setScale(0.5); // Scale down the tower sprite
    tower.setDepth(4);
    tower.setImmovable(true);

    const body = tower.body as Phaser.Physics.Arcade.Body;
    body.setImmovable(true);
    body.moves = false;

    // Set collider to bottom part of the tower (foundation)
    // Tower sprite is 256x256, scaled to 0.5 = 128x128 display size
    // Collider covers bottom 40% with good width
    body.setSize(80, 50);
    body.setOffset(88, 155); // Center horizontally, bottom of sprite

    // Set tower data
    tower.setData('type', 'tower');
    tower.setData('id', towerId);
    tower.setData('towerType', towerType);
    tower.setData('health', config.health);
    tower.setData('maxHealth', config.health);
    tower.setData('damage', config.damage);
    tower.setData('attackSpeed', config.attackSpeed);
    tower.setData('attackRange', config.attackRange);
    tower.setData('expReward', config.expReward);
    tower.setData('loot', config.loot);
    tower.setData('state', 'active' as StructureState);
    tower.setData('lastAttackTime', 0);

    // Create HP bar
    this.createHpBar(towerId);

    // Building labels removed for cleaner UI

    this.towers.add(tower);

    // Spawn guards
    for (let i = 0; i < config.guardCount; i++) {
      const guardType = config.guardTypes[Phaser.Math.Between(0, config.guardTypes.length - 1)];
      const angle = (i / config.guardCount) * Math.PI * 2;
      const guardX = x + Math.cos(angle) * 50;
      const guardY = y + Math.sin(angle) * 50;

      const guardId = `enemy_${this.enemyIdCounter++}`;
      const guard = this.spawnEnemy(guardX, guardY, guardId, guardType);
      guard.setData('towerId', towerId); // Link guard to tower
    }

    return tower;
  }

  private createHouse(x: number, y: number, houseType: HouseType): Phaser.Physics.Arcade.Sprite {
    const config = HOUSE_CONFIGS[houseType];
    const houseId = `house_${this.houseIdCounter++}`;

    // Select house sprite based on type
    const houseSpriteMap: Record<string, string> = {
      'house_small': 'building_red_house1',
      'house_medium': 'building_red_house2',
      'house_large': 'building_red_house3',
    };
    const spriteKey = houseSpriteMap[houseType] || 'building_red_house1';

    // Create house sprite using Tiny Swords building
    const house = this.physics.add.sprite(x, y, spriteKey);
    house.setScale(0.5); // Scale down the house sprite
    house.setDepth(3);
    house.setImmovable(true);

    const body = house.body as Phaser.Physics.Arcade.Body;
    body.setImmovable(true);
    body.moves = false;

    // Set collider to bottom part of the house (foundation)
    // House sprites are ~192x192, scaled to 0.5 = ~96x96 display size
    // Collider covers bottom 40% with good width
    body.setSize(70, 40);
    body.setOffset(61, 115); // Center horizontally, bottom of sprite

    // Set house data
    house.setData('type', 'house');
    house.setData('id', houseId);
    house.setData('houseType', houseType);
    house.setData('health', config.health);
    house.setData('maxHealth', config.health);
    house.setData('expReward', config.expReward);
    house.setData('loot', config.loot);
    house.setData('spawnTypes', config.spawnTypes);
    house.setData('maxSpawns', config.maxSpawns);
    house.setData('spawnInterval', config.spawnInterval);
    house.setData('spawnsRemaining', config.maxSpawns);
    house.setData('lastSpawnTime', 0);
    house.setData('state', 'active' as StructureState);

    // Create HP bar
    this.createHpBar(houseId);

    // Building labels removed for cleaner UI

    this.houses.add(house);
    return house;
  }

  // ========== PLAYER SYSTEM ==========
  // Creates the player sprite (spider), handles movement, attacks, and soul draining

  private createPlayer(): void {
    // Spawn player at base center
    const spawnX = this.baseCenter.x;
    const spawnY = this.baseCenter.y + 30; // Slightly below center of base

    // Create shadow sprite first (renders below player)
    this.playerShadow = this.add.sprite(
      spawnX,
      spawnY,
      'spider_idle_shadow_down'
    );
    this.playerShadow.setScale(0.5);
    this.playerShadow.setDepth(9); // Below player
    this.playerShadow.setAlpha(0.6); // Semi-transparent shadow
    this.playerShadow.play('spider_idle_shadow_down');

    // Create player with spider sprite
    this.player = this.physics.add.sprite(
      spawnX,
      spawnY,
      'spider_idle_down'
    );

    // Scale the sprite (256x256 to ~128x128)
    this.player.setScale(0.5);

    this.player.setCollideWorldBounds(true);
    this.player.setDepth(10);

    // Set player data
    this.player.setData('type', 'player');
    this.player.setData('health', GAME_CONFIG.PLAYER_BASE_HEALTH);
    this.player.setData('maxHealth', GAME_CONFIG.PLAYER_BASE_HEALTH);

    // Set hitbox (adjusted for scaled sprite)
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setSize(140, 140); // Hitbox in original sprite coordinates
    body.setOffset(58, 58); // Center the hitbox
    body.pushable = false; // Player cannot be pushed by enemies

    // Start idle animation
    this.player.play('spider_idle_down');

    // Listen for attack animation complete
    this.player.on('animationcomplete', (anim: Phaser.Animations.Animation) => {
      if (anim.key.includes('attack')) {
        this.isPlayerAttacking = false;
        // Return to idle or nervous after attack
        if (this.isPlayerDraining) {
          this.player.play(`spider_nervous_${this.playerDirection}`);
          this.playerShadow.play(`spider_nervous_shadow_${this.playerDirection}`);
        } else {
          this.player.play(`spider_idle_${this.playerDirection}`);
          this.playerShadow.play(`spider_idle_shadow_${this.playerDirection}`);
        }
      }
    });
  }

  private createTestEnemies(): void {
    // Create spawn points around the map (outside base radius)
    // Map is 6400x2400, base at (800, 800), zone split at 3200
    this.spawnPoints = [
      // ===== ZONE 1 (Starting Area - left half 0-3200) =====
      // Easy areas near base - weak enemies (peasants)
      { x: 400, y: 400, maxEnemies: 2, currentEnemies: 0, respawnTimer: 0, enemyTypes: ['peasant_unarmed', 'peasant_club'] as EnemyType[] },
      { x: 1200, y: 400, maxEnemies: 2, currentEnemies: 0, respawnTimer: 0, enemyTypes: ['peasant_unarmed', 'peasant_club'] as EnemyType[] },
      { x: 400, y: 1200, maxEnemies: 2, currentEnemies: 0, respawnTimer: 0, enemyTypes: ['peasant_unarmed', 'peasant_club'] as EnemyType[] },
      { x: 1200, y: 1200, maxEnemies: 2, currentEnemies: 0, respawnTimer: 0, enemyTypes: ['peasant_unarmed', 'peasant_club'] as EnemyType[] },

      // Medium areas - guards and rogues (further from base)
      { x: 1800, y: 600, maxEnemies: 3, currentEnemies: 0, respawnTimer: 0, enemyTypes: ['peasant_club', 'guard_spear'] as EnemyType[] },
      { x: 2400, y: 800, maxEnemies: 3, currentEnemies: 0, respawnTimer: 0, enemyTypes: ['peasant_club', 'guard_spear'] as EnemyType[] },
      { x: 1800, y: 1400, maxEnemies: 3, currentEnemies: 0, respawnTimer: 0, enemyTypes: ['guard_spear', 'rogue_crossbow'] as EnemyType[] },
      { x: 2400, y: 1600, maxEnemies: 3, currentEnemies: 0, respawnTimer: 0, enemyTypes: ['guard_spear', 'rogue_crossbow'] as EnemyType[] },

      // Zone 1 hard area - near portal
      { x: 2800, y: 1000, maxEnemies: 2, currentEnemies: 0, respawnTimer: 0, enemyTypes: ['guard_spear', 'knight_hammer'] as EnemyType[] },
      { x: 2800, y: 1800, maxEnemies: 2, currentEnemies: 0, respawnTimer: 0, enemyTypes: ['rogue_crossbow', 'knight_hammer'] as EnemyType[] },

      // ===== ZONE 2 (Danger Zone - right half 3200-6400) =====
      // Dense spawn areas with harder enemies
      { x: 3600, y: 400, maxEnemies: 3, currentEnemies: 0, respawnTimer: 0, enemyTypes: ['guard_spear', 'rogue_crossbow'] as EnemyType[] },
      { x: 4200, y: 400, maxEnemies: 3, currentEnemies: 0, respawnTimer: 0, enemyTypes: ['guard_spear', 'knight_hammer'] as EnemyType[] },
      { x: 4800, y: 400, maxEnemies: 3, currentEnemies: 0, respawnTimer: 0, enemyTypes: ['knight_hammer', 'hunter_rifle'] as EnemyType[] },
      { x: 5400, y: 400, maxEnemies: 3, currentEnemies: 0, respawnTimer: 0, enemyTypes: ['knight_hammer', 'hunter_rifle'] as EnemyType[] },

      // Middle row - dangerous
      { x: 3600, y: 1000, maxEnemies: 3, currentEnemies: 0, respawnTimer: 0, enemyTypes: ['rogue_crossbow', 'hunter_rifle'] as EnemyType[] },
      { x: 4200, y: 1200, maxEnemies: 3, currentEnemies: 0, respawnTimer: 0, enemyTypes: ['knight_hammer', 'knight_hammer'] as EnemyType[] },
      { x: 4800, y: 1000, maxEnemies: 3, currentEnemies: 0, respawnTimer: 0, enemyTypes: ['hunter_rifle', 'hunter_rifle'] as EnemyType[] },
      { x: 5400, y: 1200, maxEnemies: 3, currentEnemies: 0, respawnTimer: 0, enemyTypes: ['knight_hammer', 'hunter_rifle'] as EnemyType[] },

      // Bottom row - very dangerous
      { x: 3600, y: 1800, maxEnemies: 3, currentEnemies: 0, respawnTimer: 0, enemyTypes: ['guard_spear', 'knight_hammer'] as EnemyType[] },
      { x: 4200, y: 2000, maxEnemies: 4, currentEnemies: 0, respawnTimer: 0, enemyTypes: ['rogue_crossbow', 'knight_hammer'] as EnemyType[] },
      { x: 4800, y: 1800, maxEnemies: 4, currentEnemies: 0, respawnTimer: 0, enemyTypes: ['knight_hammer', 'hunter_rifle'] as EnemyType[] },
      { x: 5400, y: 2000, maxEnemies: 4, currentEnemies: 0, respawnTimer: 0, enemyTypes: ['hunter_rifle', 'hunter_rifle'] as EnemyType[] },

      // Far east - elite zone
      { x: 6000, y: 600, maxEnemies: 4, currentEnemies: 0, respawnTimer: 0, enemyTypes: ['knight_hammer', 'hunter_rifle'] as EnemyType[] },
      { x: 6000, y: 1200, maxEnemies: 4, currentEnemies: 0, respawnTimer: 0, enemyTypes: ['hunter_rifle', 'hunter_rifle'] as EnemyType[] },
      { x: 6000, y: 1800, maxEnemies: 4, currentEnemies: 0, respawnTimer: 0, enemyTypes: ['knight_hammer', 'hunter_rifle'] as EnemyType[] },
    ];

    // Draw spawn point indicators (subtle)
    this.spawnPoints.forEach((sp) => {
      const indicator = this.add.graphics();
      indicator.lineStyle(1, 0xff4444, 0.2);
      indicator.strokeCircle(sp.x, sp.y, 30);
      indicator.setDepth(0);
    });

    // Initial spawn
    this.spawnPoints.forEach((sp) => {
      for (let i = 0; i < sp.maxEnemies; i++) {
        this.spawnEnemyAtPoint(sp);
      }
    });
  }

  private spawnEnemyAtPoint(spawnPoint: { x: number; y: number; maxEnemies: number; currentEnemies: number; respawnTimer: number; enemyTypes?: EnemyType[] }): void {
    if (spawnPoint.currentEnemies >= spawnPoint.maxEnemies) return;

    // Random offset from spawn point
    const offsetX = Phaser.Math.Between(-30, 30);
    const offsetY = Phaser.Math.Between(-30, 30);

    // Pick random enemy type from spawn point's available types
    const availableTypes = spawnPoint.enemyTypes || ['peasant_unarmed'] as EnemyType[];
    const enemyType = availableTypes[Phaser.Math.Between(0, availableTypes.length - 1)];

    const enemyId = `enemy_${this.enemyIdCounter++}`;
    const enemy = this.spawnEnemy(
      spawnPoint.x + offsetX,
      spawnPoint.y + offsetY,
      enemyId,
      enemyType
    );

    // Store spawn point reference on enemy
    enemy.setData('spawnPointIndex', this.spawnPoints.indexOf(spawnPoint));
    spawnPoint.currentEnemies++;
  }

  private spawnEnemy(x: number, y: number, id: string, enemyType: EnemyType = 'peasant_unarmed'): Phaser.Physics.Arcade.Sprite {
    const config = ENEMY_CONFIGS[enemyType];

    // Use new Tiny Swords sprite if available, otherwise fallback to placeholder
    const spriteKey = config.sprites?.idle || 'enemy_placeholder';
    const enemy = this.physics.add.sprite(x, y, spriteKey);

    // Create animations for this enemy type if they exist and haven't been created yet
    if (config.sprites) {
      this.createEnemyAnimations(enemyType, config);
      // Play idle animation
      const idleAnimKey = `${enemyType}_idle`;
      if (this.anims.exists(idleAnimKey)) {
        enemy.play(idleAnimKey);
      }
    }

    // Set scale for Tiny Swords sprites (they are 192x192)
    if (config.scale) {
      enemy.setScale(config.scale);
    }

    enemy.setData('type', 'enemy');
    enemy.setData('id', id);
    enemy.setData('enemyType', enemyType);
    enemy.setData('health', config.health);
    enemy.setData('maxHealth', config.health);
    enemy.setData('damage', config.damage);
    enemy.setData('attackRange', config.attackRange);
    enemy.setData('attackSpeed', config.attackSpeed);
    enemy.setData('lastAttackTime', 0);
    enemy.setData('aggroRadius', config.aggroRadius);
    enemy.setData('moveSpeed', config.moveSpeed);
    enemy.setData('behavior', config.behavior);
    enemy.setData('state', 'idle' as EnemyState);
    enemy.setData('expReward', config.expReward);
    enemy.setData('soulValue', config.soulValue);
    enemy.setData('loot', config.loot);
    enemy.setData('attackType', 'attackType' in config ? config.attackType : 'melee');
    enemy.setCollideWorldBounds(true);
    enemy.setDepth(5);

    // Set hitbox - scale based on sprite scale
    const body = enemy.body as Phaser.Physics.Arcade.Body;
    const hitboxSize = config.scale ? Math.floor(48 * config.scale * 2) : 24;
    body.setSize(hitboxSize, hitboxSize);
    const offset = config.frameSize ? (config.frameSize - hitboxSize) / 2 : 4;
    body.setOffset(offset, offset);

    // Create HP bar graphics for this enemy
    this.createHpBar(id);

    this.enemies.add(enemy);
    return enemy;
  }

  private createEnemyAnimations(enemyType: EnemyType, config: typeof ENEMY_CONFIGS[EnemyType]): void {
    if (!config.sprites) return;

    // Tiny Swords spritesheets have 6 frames in a row
    // Use slower frameRate for better visual perception
    const IDLE_FRAME_RATE = 4;
    const RUN_FRAME_RATE = 5;
    const ATTACK_FRAME_RATE = 6;

    // Create idle animation
    const idleAnimKey = `${enemyType}_idle`;
    if (!this.anims.exists(idleAnimKey) && this.textures.exists(config.sprites.idle)) {
      const texture = this.textures.get(config.sprites.idle);
      const frameCount = texture.frameTotal - 1; // frameTotal includes __BASE, subtract 1
      this.anims.create({
        key: idleAnimKey,
        frames: this.anims.generateFrameNumbers(config.sprites.idle, { start: 0, end: Math.max(0, frameCount - 1) }),
        frameRate: IDLE_FRAME_RATE,
        repeat: -1
      });
    }

    // Create run animation
    const runAnimKey = `${enemyType}_run`;
    if (!this.anims.exists(runAnimKey) && this.textures.exists(config.sprites.run)) {
      const texture = this.textures.get(config.sprites.run);
      const frameCount = texture.frameTotal - 1;
      this.anims.create({
        key: runAnimKey,
        frames: this.anims.generateFrameNumbers(config.sprites.run, { start: 0, end: Math.max(0, frameCount - 1) }),
        frameRate: RUN_FRAME_RATE,
        repeat: -1
      });
    }

    // Create attack animation
    const attackAnimKey = `${enemyType}_attack`;
    if (!this.anims.exists(attackAnimKey) && this.textures.exists(config.sprites.attack)) {
      const texture = this.textures.get(config.sprites.attack);
      const frameCount = texture.frameTotal - 1;
      this.anims.create({
        key: attackAnimKey,
        frames: this.anims.generateFrameNumbers(config.sprites.attack, { start: 0, end: Math.max(0, frameCount - 1) }),
        frameRate: ATTACK_FRAME_RATE,
        repeat: 0
      });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private setEnemyTint(enemy: Phaser.Physics.Arcade.Sprite, _enemyType: EnemyType): void {
    // Reset tint (now using real sprites, no tint needed for normal state)
    enemy.clearTint();
  }

  private setupCamera(): void {
    const camera = this.cameras.main;
    camera.startFollow(this.player, true, GAME_CONFIG.CAMERA_LERP, GAME_CONFIG.CAMERA_LERP);

    // Use lower zoom on mobile devices for better overview
    const isMobile = this.isMobileDevice();
    const zoomLevel = isMobile ? GAME_CONFIG.CAMERA_ZOOM * 0.7 : GAME_CONFIG.CAMERA_ZOOM; // 1.4 on mobile, 2 on desktop
    camera.setZoom(zoomLevel);

    camera.setBounds(0, 0, this.mapWidth, this.mapHeight);
  }

  private isMobileDevice(): boolean {
    // Check for touch support and screen size
    const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isSmallScreen = window.innerWidth <= 1024;

    // Also check user agent for mobile devices
    const mobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

    return hasTouchScreen && (isSmallScreen || mobileUserAgent);
  }

  private setupInput(): void {
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasd = {
        W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };

      // Debug: Press U to spawn a test unit
      const uKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.U);
      uKey.on('down', () => {
        this.spawnUnit('creepy_clown');
      });

      // Portal teleportation: Press SPACE near portal
      const spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      spaceKey.on('down', () => {
        if (this.isNearPortal && this.nearPortalId > 0) {
          this.teleportThroughPortal(this.nearPortalId);
        }
      });

      // Open Art Gallery with G key
      const gKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.G);
      gKey.on('down', () => {
        this.scene.pause('MainScene');
        this.scene.pause('UIScene');
        this.scene.launch('ArtGalleryScene');
      });
    }
  }

  private setupCollisions(): void {
    // Physical collisions - entities
    this.physics.add.collider(this.player, this.enemies);
    this.physics.add.collider(this.enemies, this.enemies);
    this.physics.add.collider(this.corpses, this.corpses);
    this.physics.add.collider(this.units, this.units);
    this.physics.add.collider(this.units, this.enemies);

    // Collisions with resource deposits (static objects)
    this.physics.add.collider(this.player, this.resourceDeposits);
    this.physics.add.collider(this.enemies, this.resourceDeposits);
    this.physics.add.collider(this.units, this.resourceDeposits);

    // Collisions with buildings (towers and houses)
    this.physics.add.collider(this.player, this.towers);
    this.physics.add.collider(this.player, this.houses);
    this.physics.add.collider(this.enemies, this.towers);
    this.physics.add.collider(this.enemies, this.houses);
    this.physics.add.collider(this.units, this.towers);
    this.physics.add.collider(this.units, this.houses);

    // Collisions with decoration colliders (trees, large bushes)
    this.physics.add.collider(this.player, this.decorColliders);
    this.physics.add.collider(this.enemies, this.decorColliders);
    this.physics.add.collider(this.units, this.decorColliders);

    // Resource pickup
    this.physics.add.overlap(
      this.player,
      this.droppedResources,
      this.handleResourcePickup as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this
    );

    // Storage zone overlap
    this.physics.add.overlap(
      this.player,
      this.storageZone,
      this.handleStorageOverlap as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this
    );

    // Workbench zone overlap
    this.physics.add.overlap(
      this.player,
      this.workbenchZone,
      this.handleWorkbenchOverlap as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this
    );
  }

  private handleStorageOverlap(): void {
    if (!this.isInStorageRange) {
      this.isInStorageRange = true;
      // Emit event to transfer cargo to storage
      gameEvents.emit('cargo:deposit-to-storage', undefined);
    }
  }

  private handleWorkbenchOverlap(): void {
    if (!this.isInWorkbenchRange) {
      this.isInWorkbenchRange = true;
      // Emit event to show workbench UI is available
      gameEvents.emit('workbench:in-range', { inRange: true });
    }
  }

  private onCargoDeposited(data: { scrap: number; polymer: number; gems: number; total: number }): void {
    if (data.total > 0) {
      // Create visual resources flying from player to storage
      this.createResourceTransferEffect(data);

      // Show floating text for deposit
      this.showFloatingText(
        this.storageBuilding.x,
        this.storageBuilding.y - 20,
        `+${data.total} deposited`,
        0xdaa520
      );

      // Flash storage building after resources arrive
      this.time.delayedCall(500, () => {
        this.storageBuilding.setTint(0xffd700);
        this.time.delayedCall(200, () => {
          this.storageBuilding.clearTint();
        });
      });
    }
  }

  private createResourceTransferEffect(data: { scrap: number; polymer: number; gems: number }): void {
    const resourceTypes: Array<{ type: string; amount: number; color: number; sprite: string }> = [
      { type: 'scrap', amount: data.scrap, color: 0x708090, sprite: 'resource_scrap' },
      { type: 'polymer', amount: data.polymer, color: 0x32cd32, sprite: 'resource_polymer' },
      { type: 'gems', amount: data.gems, color: 0x00bfff, sprite: 'resource_gems' },
    ];

    let delay = 0;
    for (const res of resourceTypes) {
      if (res.amount <= 0) continue;

      // Create 1-3 sprites per resource type (more for larger amounts)
      const spriteCount = Math.min(3, Math.max(1, Math.ceil(res.amount / 5)));

      for (let i = 0; i < spriteCount; i++) {
        const spawnX = this.player.x + Phaser.Math.Between(-15, 15);
        const spawnY = this.player.y + Phaser.Math.Between(-15, 15);

        // Create resource sprite or circle fallback
        const useSprite = this.textures.exists(res.sprite);
        let resource: Phaser.GameObjects.Sprite | Phaser.GameObjects.Arc;

        if (useSprite) {
          resource = this.add.sprite(spawnX, spawnY, res.sprite);
          (resource as Phaser.GameObjects.Sprite).setScale(0.5);
        } else {
          resource = this.add.circle(spawnX, spawnY, 5, res.color);
        }
        resource.setDepth(100);

        // Calculate target and arc
        const targetX = this.storageBuilding.x;
        const targetY = this.storageBuilding.y;
        const distance = Phaser.Math.Distance.Between(spawnX, spawnY, targetX, targetY);
        const arcHeight = Math.min(60, distance * 0.25);

        // Animate to storage with arc
        this.tweens.add({
          targets: resource,
          x: targetX,
          y: targetY,
          duration: 400 + i * 50,
          delay: delay + i * 80,
          ease: 'Sine.easeIn',
          onUpdate: (tween) => {
            const progress = tween.progress;
            const arcOffset = Math.sin(progress * Math.PI) * arcHeight;
            resource.y = Phaser.Math.Linear(spawnY, targetY, progress) - arcOffset;
          },
          onComplete: () => {
            // Small flash at destination
            this.tweens.add({
              targets: resource,
              scale: 0.1,
              alpha: 0,
              duration: 100,
              onComplete: () => resource.destroy(),
            });
          },
        });
      }
      delay += 100; // Stagger different resource types
    }
  }

  private handleResourcePickup(
    _player: Phaser.GameObjects.GameObject,
    resource: Phaser.GameObjects.GameObject
  ): void {
    const sprite = resource as Phaser.Physics.Arcade.Sprite;
    const resourceType = sprite.getData('resourceType') as string;
    const amount = sprite.getData('amount') as number;

    // Check if already tried to pick up this resource (to prevent spam)
    if (sprite.getData('pickupAttempted')) return;

    // Try to emit resource collected event
    // The store will handle checking cargo capacity
    gameEvents.emit('resource:collected', { type: resourceType, amount });

    // Mark as attempted to prevent repeated floating texts
    sprite.setData('pickupAttempted', true);

    // Show floating text
    this.showFloatingText(sprite.x, sprite.y, `+${amount}`, this.getResourceColor(resourceType));

    // Show soul collection effect for souls
    if (resourceType === 'souls') {
      this.showSoulCollectEffect(sprite.x, sprite.y);
    }

    // Destroy resource
    sprite.destroy();
  }

  private showSoulCollectEffect(x: number, y: number): void {
    // Purple fire effect for soul collection
    const purpleColor = 0x9932cc;

    // Use Fire animation with purple tint
    if (this.anims.exists('fire_anim')) {
      const fire = this.add.sprite(x, y, 'effect_fire1');
      fire.setScale(0.6);
      fire.setDepth(100);
      fire.setTint(purpleColor);
      fire.setAlpha(0.9);
      fire.play('fire_anim');

      // Fire rises and fades
      this.tweens.add({
        targets: fire,
        y: y - 40,
        alpha: 0,
        scaleX: 0.3,
        scaleY: 0.8,
        duration: 600,
        ease: 'Power2',
        onComplete: () => fire.destroy(),
      });
    }

    // Create expanding ring
    const ring = this.add.circle(x, y, 5, purpleColor, 0.8);
    ring.setStrokeStyle(2, purpleColor);
    ring.setDepth(99);

    this.tweens.add({
      targets: ring,
      scaleX: 3,
      scaleY: 3,
      alpha: 0,
      duration: 400,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy()
    });

    // Create rising particles that fly to player
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const particle = this.add.circle(
        x + Math.cos(angle) * 15,
        y + Math.sin(angle) * 15,
        4,
        purpleColor,
        0.9
      );
      particle.setDepth(101);

      this.tweens.add({
        targets: particle,
        x: this.player.x,
        y: this.player.y,
        alpha: 0,
        scale: 0.1,
        duration: 350 + i * 50,
        ease: 'Quad.easeIn',
        onComplete: () => particle.destroy()
      });
    }

    // Flash player purple briefly
    this.player.setTint(purpleColor);
    this.time.delayedCall(200, () => this.player.clearTint());
  }

  private getResourceColor(type: string): number {
    switch (type) {
      case 'scrap': return 0x708090;
      case 'polymer': return 0x32cd32;
      case 'gems': return 0x00bfff;
      default: return 0xffffff;
    }
  }

  private setupJoystickListener(): void {
    gameEvents.on('joystick:move', (data) => {
      this.joystickDirection = { x: data.x, y: data.y };
      this.joystickForce = data.force;
    });

    gameEvents.on('joystick:stop', () => {
      this.joystickDirection = { x: 0, y: 0 };
      this.joystickForce = 0;
    });

    // Listen for cargo deposited event
    gameEvents.on('cargo:deposited', (data) => {
      this.onCargoDeposited(data);
    });

    // Listen for cargo full event
    gameEvents.on('cargo:full', () => {
      this.showFloatingText(this.player.x, this.player.y - 30, 'CARGO FULL!', 0xff4444);
    });

    // Listen for unit spawn request
    gameEvents.on('unit:spawn-request', (data: { unitType: string }) => {
      this.spawnUnit(data.unitType);
    });

    // Listen for level up event to show visual effect
    gameEvents.on('player:level-up', (data: { newLevel: number }) => {
      this.showLevelUpEffect(data.newLevel);
    });

    // Listen for upgrade purchased event
    gameEvents.on('player:upgrade-purchased', (data: { upgradeId: string; newLevel: number }) => {
      this.applyUpgrade(data.upgradeId, data.newLevel);
    });
  }

  private applyUpgrade(upgradeId: string, newLevel: number): void {
    switch (upgradeId) {
      case 'health': {
        const newMaxHealth = GAME_CONFIG.PLAYER_BASE_HEALTH + (20 * newLevel);
        const currentHealth = this.player.getData('health') as number;
        const currentMaxHealth = this.player.getData('maxHealth') as number;
        // Heal by the amount the max health increased
        const healthIncrease = newMaxHealth - currentMaxHealth;
        this.player.setData('maxHealth', newMaxHealth);
        this.player.setData('health', Math.min(currentHealth + healthIncrease, newMaxHealth));
        gameEvents.emit('player:health-changed', {
          current: this.player.getData('health') as number,
          max: newMaxHealth,
        });
        break;
      }
      case 'damage':
        this.playerDamage = GAME_CONFIG.PLAYER_BASE_DAMAGE + (5 * newLevel);
        break;
      case 'speed':
        this.playerSpeed = GAME_CONFIG.PLAYER_BASE_SPEED * (1 + 0.1 * newLevel);
        break;
      case 'cargo':
        // Cargo is handled by the store, but we can emit an event if needed
        break;
      case 'attackSpeed':
        this.playerAttackSpeed = GAME_CONFIG.PLAYER_BASE_ATTACK_SPEED * (1 - 0.1 * newLevel);
        break;
      case 'drainSpeed':
        this.soulDrainTime = GAME_CONFIG.PLAYER_BASE_SOUL_DRAIN_TIME * 1000 * (1 - 0.15 * newLevel);
        break;
    }

    // Show upgrade effect
    this.showFloatingText(this.player.x, this.player.y - 30, `UPGRADED!`, 0x32cd32);
    this.player.setTint(0x32cd32);
    this.time.delayedCall(200, () => this.player.setTint(0xffffff));
  }

  private showLevelUpEffect(newLevel: number): void {
    // Purple color for level up (matches XP bar)
    const purpleColor = 0x8844ff;

    // Flash effect on player - purple color
    this.player.setTint(purpleColor);
    this.time.delayedCall(100, () => this.player.setTint(0xffffff));
    this.time.delayedCall(200, () => this.player.setTint(purpleColor));
    this.time.delayedCall(300, () => this.player.setTint(0xffffff));
    this.time.delayedCall(400, () => this.player.setTint(purpleColor));
    this.time.delayedCall(500, () => this.player.setTint(0xffffff));

    // Floating text - purple
    this.showFloatingText(this.player.x, this.player.y - 50, `LEVEL UP! Lv.${newLevel}`, purpleColor);

    // Multiple expanding rings effect (no explosion)
    for (let i = 0; i < 3; i++) {
      this.time.delayedCall(i * 150, () => {
        const ring = this.add.circle(this.player.x, this.player.y, 15, purpleColor, 0);
        ring.setStrokeStyle(3 - i, purpleColor, 1);
        ring.setDepth(99);
        this.tweens.add({
          targets: ring,
          scaleX: 5,
          scaleY: 5,
          alpha: 0,
          duration: 800,
          ease: 'Power2',
          onComplete: () => ring.destroy(),
        });
      });
    }

    // Particle burst effect - purple particles rising up
    const particles = this.add.particles(this.player.x, this.player.y, 'particle_placeholder', {
      speed: { min: 50, max: 150 },
      angle: { min: 250, max: 290 }, // Upward
      scale: { start: 0.5, end: 0 },
      lifespan: 1200,
      quantity: 20,
      tint: purpleColor,
      emitting: false,
    });
    particles.explode(20);
    this.time.delayedCall(1400, () => particles.destroy());

    // Emit event for UI to show XP bar pulse effect
    gameEvents.emit('player:level-up-visual', { newLevel });
  }

  update(time: number, delta: number): void {
    this.handlePlayerMovement();
    this.handlePlayerAutoAttack(time);
    this.updateEnemies(time);
    this.updateUnits(time);
    this.updateTowers(time);
    this.updateHouses(time);
    this.updateFarms(time);
    this.updateSheep(time);
    this.updateHpBars();
    this.checkStorageRange();
    this.updateBaseRegen(time);
    this.updateBaseIndicator();
    this.checkWorkbenchRange();
    this.checkPortalRange();
    this.checkFarmRange();
    this.updateSoulDraining(delta);
    this.checkForCorpseInteraction();
    this.checkEnemyRespawn(time, delta);

    // Update quest move objectives
    if (this.player && this.player.active) {
      questManager.updateMoveObjective(this.player.x, this.player.y);
    }
  }

  private checkEnemyRespawn(time: number, _delta: number): void {
    // Check respawn at intervals to save performance
    if (time - this.lastSpawnCheck < GAME_CONFIG.SPAWN_CHECK_INTERVAL) return;

    const elapsed = time - this.lastSpawnCheck;
    this.lastSpawnCheck = time;

    this.spawnPoints.forEach((sp) => {
      // If spawn point needs enemies
      if (sp.currentEnemies < sp.maxEnemies) {
        // Decrease respawn timer by actual elapsed time
        if (sp.respawnTimer > 0) {
          sp.respawnTimer -= elapsed;
        }

        // Check if respawn timer is ready
        if (sp.respawnTimer <= 0) {
          // Check if player is not too close to spawn point
          const distanceToPlayer = Phaser.Math.Distance.Between(
            sp.x,
            sp.y,
            this.player.x,
            this.player.y
          );

          // Only spawn if player is far enough away
          if (distanceToPlayer > 200) {
            this.spawnEnemyAtPoint(sp);
            // Set respawn timer for next spawn (5-10 seconds)
            sp.respawnTimer = Phaser.Math.Between(5000, 10000);
          }
        }
      }
    });
  }

  private checkStorageRange(): void {
    const distance = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      this.storageBuilding.x,
      this.storageBuilding.y
    );

    if (distance > GAME_CONFIG.STORAGE_COLLECT_RADIUS) {
      this.isInStorageRange = false;
    }
  }

  // HP regeneration when player is at base (near storage)
  private updateBaseRegen(time: number): void {
    if (!this.isInStorageRange) return;

    const REGEN_INTERVAL = 1000; // 1 second between heals
    const REGEN_AMOUNT = 5; // HP restored per tick

    if (time - this.lastBaseRegenTime < REGEN_INTERVAL) return;

    const currentHealth = this.player.getData('health') as number;
    const maxHealth = this.player.getData('maxHealth') as number;

    if (currentHealth >= maxHealth) return;

    // Heal player
    const newHealth = Math.min(currentHealth + REGEN_AMOUNT, maxHealth);
    this.player.setData('health', newHealth);
    this.lastBaseRegenTime = time;

    // Emit health update event
    gameEvents.emit('player:health-changed', { current: newHealth, max: maxHealth });

    // Show green healing effect
    this.showHealEffect();
  }

  private showHealEffect(): void {
    // Green healing particles rising from player
    const healColor = 0x44ff44;

    // Create small green particles
    for (let i = 0; i < 5; i++) {
      const offsetX = Phaser.Math.Between(-15, 15);
      const particle = this.add.circle(
        this.player.x + offsetX,
        this.player.y + 10,
        3,
        healColor,
        0.8
      );
      particle.setDepth(100);

      // Float upward and fade out
      this.tweens.add({
        targets: particle,
        y: this.player.y - 30,
        alpha: 0,
        scale: 0.5,
        duration: 600,
        delay: i * 50,
        ease: 'Quad.easeOut',
        onComplete: () => particle.destroy(),
      });
    }

    // Subtle green flash on player
    this.player.setTint(healColor);
    this.time.delayedCall(100, () => {
      if (this.player.active) {
        this.player.clearTint();
      }
    });
  }

  // Update base direction indicator arrow
  private updateBaseIndicator(): void {
    this.baseIndicatorArrow.clear();

    // Check if storage building is visible on screen
    const camera = this.cameras.main;
    const storageScreenPos = {
      x: this.storageBuilding.x - camera.scrollX,
      y: this.storageBuilding.y - camera.scrollY,
    };

    // Screen bounds with some margin
    const margin = 50;
    const isOnScreen =
      storageScreenPos.x >= -margin &&
      storageScreenPos.x <= camera.width + margin &&
      storageScreenPos.y >= -margin &&
      storageScreenPos.y <= camera.height + margin;

    if (isOnScreen) {
      return; // Don't show arrow if base is visible
    }

    // Calculate direction from player to storage
    const angle = Phaser.Math.Angle.Between(
      this.player.x,
      this.player.y,
      this.storageBuilding.x,
      this.storageBuilding.y
    );

    // Position arrow at screen edge
    const arrowDistance = 60; // Distance from screen center
    const screenCenterX = camera.width / 2;
    const screenCenterY = camera.height / 2;

    // Calculate arrow position at edge of screen
    const arrowX = screenCenterX + Math.cos(angle) * (Math.min(camera.width, camera.height) / 2 - arrowDistance);
    const arrowY = screenCenterY + Math.sin(angle) * (Math.min(camera.width, camera.height) / 2 - arrowDistance);

    // Draw arrow pointing to base
    const arrowSize = 12;
    const arrowColor = 0xdaa520; // Gold color matching storage

    this.baseIndicatorArrow.fillStyle(arrowColor, 0.8);
    this.baseIndicatorArrow.lineStyle(2, 0x000000, 0.5);

    // Draw triangle arrow
    const tipX = arrowX + Math.cos(angle) * arrowSize;
    const tipY = arrowY + Math.sin(angle) * arrowSize;
    const leftX = arrowX + Math.cos(angle + 2.5) * arrowSize;
    const leftY = arrowY + Math.sin(angle + 2.5) * arrowSize;
    const rightX = arrowX + Math.cos(angle - 2.5) * arrowSize;
    const rightY = arrowY + Math.sin(angle - 2.5) * arrowSize;

    this.baseIndicatorArrow.beginPath();
    this.baseIndicatorArrow.moveTo(tipX, tipY);
    this.baseIndicatorArrow.lineTo(leftX, leftY);
    this.baseIndicatorArrow.lineTo(rightX, rightY);
    this.baseIndicatorArrow.closePath();
    this.baseIndicatorArrow.fillPath();
    this.baseIndicatorArrow.strokePath();

    // Draw small house icon behind arrow
    this.baseIndicatorArrow.fillStyle(arrowColor, 0.6);
    this.baseIndicatorArrow.fillCircle(arrowX - Math.cos(angle) * 8, arrowY - Math.sin(angle) * 8, 6);
  }

  private checkWorkbenchRange(): void {
    const distance = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      this.workbenchBuilding.x,
      this.workbenchBuilding.y
    );

    if (distance > GAME_CONFIG.WORKBENCH_INTERACT_RADIUS) {
      if (this.isInWorkbenchRange) {
        this.isInWorkbenchRange = false;
        gameEvents.emit('workbench:in-range', { inRange: false });
      }
    }
  }

  private checkPortalRange(): void {
    const PORTAL_INTERACT_RADIUS = 60;

    // Check Portal 1
    if (this.portal1) {
      const distance1 = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        this.portal1.x,
        this.portal1.y
      );

      if (distance1 <= PORTAL_INTERACT_RADIUS) {
        this.isNearPortal = true;
        this.nearPortalId = 1;
        this.portal1UseText.setVisible(true);
        if (this.portal2UseText) this.portal2UseText.setVisible(false);
        return;
      }
    }

    // Check Portal 2
    if (this.portal2) {
      const distance2 = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        this.portal2.x,
        this.portal2.y
      );

      if (distance2 <= PORTAL_INTERACT_RADIUS) {
        this.isNearPortal = true;
        this.nearPortalId = 2;
        this.portal2UseText.setVisible(true);
        if (this.portal1UseText) this.portal1UseText.setVisible(false);
        return;
      }
    }

    // Not near any portal
    if (this.isNearPortal) {
      this.isNearPortal = false;
      this.nearPortalId = 0;
      if (this.portal1UseText) this.portal1UseText.setVisible(false);
      if (this.portal2UseText) this.portal2UseText.setVisible(false);
    }
  }

  private teleportThroughPortal(fromPortalId: number): void {
    // Determine destination based on which portal we're using
    let destX: number;
    let destY: number;
    let newZone: number;

    if (fromPortalId === 1) {
      // Teleport to Zone 2 (slightly past portal 2)
      destX = this.portal2.x + 80;
      destY = this.portal2.y;
      newZone = 2;
    } else {
      // Teleport back to Zone 1 (slightly past portal 1 towards base)
      destX = this.portal1.x - 80;
      destY = this.portal1.y;
      newZone = 1;
    }

    // Visual teleport effect on player
    this.createTeleportEffect(this.player.x, this.player.y);

    // Teleport player
    this.player.setPosition(destX, destY);
    this.updateShadowPosition();

    // Teleport units too
    this.units.getChildren().forEach((unit) => {
      const sprite = unit as Phaser.Physics.Arcade.Sprite;
      if (sprite.getData('state') !== 'dead') {
        // Spread units around destination
        const offsetX = Phaser.Math.Between(-60, 60);
        const offsetY = Phaser.Math.Between(-60, 60);
        sprite.setPosition(destX + offsetX, destY + offsetY);
      }
    });

    // Visual teleport effect at destination
    this.createTeleportEffect(destX, destY);

    // Emit zone change event
    gameEvents.emit('zone:changed', { zone: newZone });
  }

  private createTeleportEffect(x: number, y: number): void {
    const particles: Phaser.GameObjects.Arc[] = [];
    const particleCount = 20;

    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const particle = this.add.circle(x, y, 4, 0xcc66ff);
      particle.setDepth(10);
      particles.push(particle);

      // Animate particles outward
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * 80,
        y: y + Math.sin(angle) * 80,
        alpha: 0,
        scale: 0.1,
        duration: 500,
        ease: 'Power2',
        onComplete: () => {
          particle.destroy();
        },
      });
    }

    // Flash effect
    const flash = this.add.circle(x, y, 50, 0xffffff, 0.8);
    flash.setDepth(9);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 2,
      duration: 300,
      onComplete: () => {
        flash.destroy();
      },
    });
  }

  private updateFarms(time: number): void {
    // Update farms every second for performance
    if (time - this.lastFarmUpdate < 1000) return;
    this.lastFarmUpdate = time;

    this.farms.forEach((farm) => {
      const storedResources = farm.getData('storedResources') as number;
      const capacity = farm.getData('capacity') as number;
      const productionRate = farm.getData('productionRate') as number; // per minute
      const lastProductionTime = farm.getData('lastProductionTime') as number;

      // Calculate time elapsed since last update (in minutes)
      const elapsedMinutes = (time - lastProductionTime) / 60000;

      // Calculate resources produced
      const produced = elapsedMinutes * productionRate;

      // Add to storage (capped at capacity)
      const newStored = Math.min(storedResources + produced, capacity);
      farm.setData('storedResources', newStored);
      farm.setData('lastProductionTime', time);

      // Update display text
      const resourceText = farm.getData('resourceText') as Phaser.GameObjects.Text;
      if (resourceText) {
        resourceText.setText(`${Math.floor(newStored)} / ${Math.floor(capacity)}`);

        // Change color based on fill level
        if (newStored >= capacity * 0.9) {
          resourceText.setColor('#ff6666'); // Red when almost full
        } else if (newStored >= capacity * 0.5) {
          resourceText.setColor('#ffff66'); // Yellow when half full
        } else {
          resourceText.setColor('#aaffaa'); // Green when low
        }
      }
    });
  }

  // Sheep wandering behavior - they slowly wander around their spawn point
  private updateSheep(time: number): void {
    const WATER_MARGIN = 120; // Safe distance from ocean (slightly more than water border)
    const WANDER_RADIUS = 60; // How far sheep can wander from origin
    const WANDER_SPEED = 20; // Slow walking speed (slower than player's 100)

    this.resourceDeposits.getChildren().forEach((depositObj) => {
      const deposit = depositObj as Phaser.Physics.Arcade.Sprite;
      const resourceType = deposit.getData('resourceType') as string;

      // Only update sheep (scrap type)
      if (resourceType !== 'scrap') return;

      // Initialize sheep wandering data if not set
      if (deposit.getData('wanderState') === undefined) {
        deposit.setData('wanderState', 'idle'); // 'idle' or 'walking'
        deposit.setData('wanderTargetX', deposit.x);
        deposit.setData('wanderTargetY', deposit.y);
        deposit.setData('wanderOriginX', deposit.x);
        deposit.setData('wanderOriginY', deposit.y);
        deposit.setData('nextWanderTime', time + Phaser.Math.Between(2000, 5000));
        // Make sheep movable
        const body = deposit.body as Phaser.Physics.Arcade.Body;
        if (body) {
          body.moves = true;
        }
      }

      // Always clamp sheep position to safe zone (prevent ocean escape)
      const safeX = Phaser.Math.Clamp(deposit.x, WATER_MARGIN, this.mapWidth - WATER_MARGIN);
      const safeY = Phaser.Math.Clamp(deposit.y, WATER_MARGIN, this.mapHeight - WATER_MARGIN);
      if (deposit.x !== safeX || deposit.y !== safeY) {
        deposit.setPosition(safeX, safeY);
        deposit.setVelocity(0, 0);
        deposit.setData('wanderState', 'idle');
        deposit.setData('nextWanderTime', time + Phaser.Math.Between(1000, 3000));
        if (this.anims.exists('sheep_idle_anim')) {
          deposit.play('sheep_idle_anim', true);
        }
        return;
      }

      const wanderState = deposit.getData('wanderState') as string;
      const nextWanderTime = deposit.getData('nextWanderTime') as number;
      const originX = deposit.getData('wanderOriginX') as number;
      const originY = deposit.getData('wanderOriginY') as number;

      if (wanderState === 'idle') {
        // Check if it's time to start walking
        if (time >= nextWanderTime) {
          // Pick a random target within wander radius
          const angle = Math.random() * Math.PI * 2;
          const distance = Phaser.Math.Between(20, WANDER_RADIUS);
          const targetX = originX + Math.cos(angle) * distance;
          const targetY = originY + Math.sin(angle) * distance;

          // Clamp to safe zone (away from water)
          const clampedX = Phaser.Math.Clamp(targetX, WATER_MARGIN, this.mapWidth - WATER_MARGIN);
          const clampedY = Phaser.Math.Clamp(targetY, WATER_MARGIN, this.mapHeight - WATER_MARGIN);

          deposit.setData('wanderTargetX', clampedX);
          deposit.setData('wanderTargetY', clampedY);
          deposit.setData('wanderState', 'walking');

          // Play walk animation
          if (this.anims.exists('sheep_walk_anim')) {
            deposit.play('sheep_walk_anim', true);
          }

          // Flip based on direction
          deposit.setFlipX(clampedX < deposit.x);
        }
      } else if (wanderState === 'walking') {
        const targetX = deposit.getData('wanderTargetX') as number;
        const targetY = deposit.getData('wanderTargetY') as number;
        const distanceToTarget = Phaser.Math.Distance.Between(deposit.x, deposit.y, targetX, targetY);

        if (distanceToTarget < 5) {
          // Reached target, go back to idle
          deposit.setData('wanderState', 'idle');
          deposit.setData('nextWanderTime', time + Phaser.Math.Between(3000, 8000));
          deposit.setVelocity(0, 0);

          // Play idle animation
          if (this.anims.exists('sheep_idle_anim')) {
            deposit.play('sheep_idle_anim', true);
          }
        } else {
          // Move toward target
          const angle = Phaser.Math.Angle.Between(deposit.x, deposit.y, targetX, targetY);
          deposit.setVelocity(
            Math.cos(angle) * WANDER_SPEED,
            Math.sin(angle) * WANDER_SPEED
          );

          // Flip based on movement direction
          deposit.setFlipX(Math.cos(angle) < 0);
        }
      }
    });
  }

  private checkFarmRange(): void {
    let foundFarm = false;

    this.farms.forEach((farm, farmId) => {
      const distance = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        farm.x,
        farm.y
      );

      if (distance <= GAME_CONFIG.FARM_INTERACT_RADIUS && !foundFarm) {
        foundFarm = true;
        this.isNearFarm = true;

        // Check if there are resources to collect
        const storedResources = farm.getData('storedResources') as number;
        if (storedResources >= 1) {
          // Auto-collect resources when in range
          this.collectFarmResources(farmId);
        }
      }
    });

    if (!foundFarm && this.isNearFarm) {
      this.isNearFarm = false;
    }
  }

  private collectFarmResources(farmId: string): void {
    const farm = this.farms.get(farmId);
    if (!farm) return;

    const storedResources = farm.getData('storedResources') as number;
    if (storedResources < 1) return;

    const farmType = farm.getData('farmType') as FarmType;
    const config = FARM_CONFIGS[farmType];
    const resourceType = config.resourceType;

    // Collect integer amount
    const toCollect = Math.floor(storedResources);

    // Add to player's stored resources
    gameEvents.emit('resources:collected', {
      type: resourceType,
      amount: toCollect,
      fromFarm: true,
    });

    // Update farm storage
    farm.setData('storedResources', storedResources - toCollect);

    // Visual effect
    this.createFarmCollectEffect(farm.x, farm.y, resourceType);

    // Update display
    const capacity = farm.getData('capacity') as number;
    const newStored = storedResources - toCollect;
    const resourceText = farm.getData('resourceText') as Phaser.GameObjects.Text;
    if (resourceText) {
      resourceText.setText(`${Math.floor(newStored)} / ${Math.floor(capacity)}`);
      resourceText.setColor('#aaffaa');
    }
  }

  private createFarmCollectEffect(x: number, y: number, resourceType: string): void {
    const colors: Record<string, number> = {
      scrap: 0xe07050, // Meat color
      polymer: 0x8B4513, // Wood color
      gems: 0xFFD700, // Gold color
    };
    const color = colors[resourceType] || 0xffffff;

    // Get resource sprite key based on type (scrap=meat, polymer=wood, gems=gold)
    const resourceSprites: Record<string, string> = {
      scrap: 'resource_meat',
      polymer: 'resource_wood',
      gems: 'resource_gold',
    };
    const spriteKey = resourceSprites[resourceType] || 'resource_meat';

    // Create 3-5 resource sprites that fly to storage
    const resourceCount = Phaser.Math.Between(3, 5);
    for (let i = 0; i < resourceCount; i++) {
      // Spawn resource at farm with slight scatter
      const spawnX = x + Phaser.Math.Between(-20, 20);
      const spawnY = y + Phaser.Math.Between(-20, 20);

      // Check if texture exists, otherwise use circle
      const useSprite = this.textures.exists(spriteKey);
      let resource: Phaser.GameObjects.Sprite | Phaser.GameObjects.Arc;

      if (useSprite) {
        resource = this.add.sprite(spawnX, spawnY, spriteKey);
        (resource as Phaser.GameObjects.Sprite).setScale(0.6);
      } else {
        resource = this.add.circle(spawnX, spawnY, 6, color);
      }
      resource.setDepth(100);

      // Calculate target position (storage building)
      const targetX = this.storageBuilding.x;
      const targetY = this.storageBuilding.y;

      // Calculate arc height based on distance
      const distance = Phaser.Math.Distance.Between(spawnX, spawnY, targetX, targetY);
      const arcHeight = Math.min(80, distance * 0.3);

      // Stagger the animations
      const delay = i * 100;

      // First tween: arc up and towards storage
      this.tweens.add({
        targets: resource,
        x: targetX,
        y: targetY,
        duration: 600 + i * 50,
        delay: delay,
        ease: 'Sine.easeInOut',
        onUpdate: (tween) => {
          // Add arc by modifying Y based on progress
          const progress = tween.progress;
          const arcOffset = Math.sin(progress * Math.PI) * arcHeight;
          resource.y = Phaser.Math.Linear(spawnY, targetY, progress) - arcOffset;
        },
        onComplete: () => {
          // Flash effect at storage
          this.tweens.add({
            targets: resource,
            scale: 0.2,
            alpha: 0,
            duration: 150,
            onComplete: () => {
              resource.destroy();
            },
          });
        },
      });
    }

    // Create floating +N text
    const floatingText = this.add.text(x, y - 20, '+', {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    });
    floatingText.setOrigin(0.5);
    floatingText.setDepth(10);

    // Animate upward and fade
    this.tweens.add({
      targets: floatingText,
      y: y - 50,
      alpha: 0,
      duration: 800,
      ease: 'Power2',
      onComplete: () => {
        floatingText.destroy();
      },
    });
  }

  private handlePlayerMovement(): void {
    // Allow movement even during attack (player can move + attack simultaneously)
    let velocityX = 0;
    let velocityY = 0;

    if (this.cursors && this.wasd) {
      if (this.cursors.left.isDown || this.wasd.A.isDown) {
        velocityX = -1;
      } else if (this.cursors.right.isDown || this.wasd.D.isDown) {
        velocityX = 1;
      }

      if (this.cursors.up.isDown || this.wasd.W.isDown) {
        velocityY = -1;
      } else if (this.cursors.down.isDown || this.wasd.S.isDown) {
        velocityY = 1;
      }
    }

    if (this.joystickForce > 0.1) {
      velocityX = this.joystickDirection.x;
      velocityY = this.joystickDirection.y;
    }

    if (velocityX !== 0 && velocityY !== 0) {
      const length = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
      velocityX /= length;
      velocityY /= length;
    }

    const speed = this.playerSpeed * (this.joystickForce > 0.1 ? this.joystickForce : 1);
    this.player.setVelocity(velocityX * speed, velocityY * speed);

    // Determine direction based on velocity (8-directional)
    const isMoving = velocityX !== 0 || velocityY !== 0;

    if (isMoving) {
      // Determine 8-directional direction based on angle
      const newDirection = this.getDirectionFromVelocity(velocityX, velocityY);

      // Calculate animation speed based on movement speed
      // joystickForce ranges from 0.1 to 1.0, animation should match
      const movementRatio = this.joystickForce > 0.1 ? this.joystickForce : 1;
      // Minimum animation speed of 0.4 to prevent too slow animations
      const animSpeed = Math.max(0.4, movementRatio);

      // Update direction and animation (but attack animation takes priority)
      if (!this.isPlayerAttacking) {
        if (newDirection !== this.playerDirection || !this.player.anims.currentAnim?.key.includes('walk')) {
          this.playerDirection = newDirection;
          this.player.play(`spider_walk_${this.playerDirection}`, true);
          this.playerShadow.play(`spider_walk_shadow_${this.playerDirection}`, true);
        }
        // Adjust animation speed to match movement speed
        this.player.anims.timeScale = animSpeed;
        this.playerShadow.anims.timeScale = animSpeed;
      } else {
        // Update direction for attack but don't change animation
        this.playerDirection = newDirection;
      }
    } else {
      // Standing still - reset animation speed and play idle or nervous
      this.player.anims.timeScale = 1;
      this.playerShadow.anims.timeScale = 1;

      if (this.isPlayerDraining) {
        if (!this.player.anims.currentAnim?.key.includes('nervous')) {
          this.player.play(`spider_nervous_${this.playerDirection}`, true);
          this.playerShadow.play(`spider_nervous_shadow_${this.playerDirection}`, true);
        }
      } else if (!this.isPlayerAttacking) {
        // Only switch to idle if not currently attacking
        if (!this.player.anims.currentAnim?.key.includes('idle')) {
          this.player.play(`spider_idle_${this.playerDirection}`, true);
          this.playerShadow.play(`spider_idle_shadow_${this.playerDirection}`, true);
        }
      }
    }

    // Update shadow position
    this.updateShadowPosition();

    gameEvents.emit('player:position', { x: this.player.x, y: this.player.y });
  }

  private getDirectionFromVelocity(vx: number, vy: number): PlayerDirection {
    // Calculate angle in degrees
    // atan2 gives: 0°=right, 90°=down, 180°/-180°=left, -90°=up
    const angle = Math.atan2(vy, vx) * (180 / Math.PI);

    // Testing results (iteration 3) - all sprites are rotated 90° CCW:
    // up->right, down->left, left->up, right->down
    // up_left->up_right, up_right->down_right, down_left->up_left, down_right->down_left
    //
    // To fix, rotate 90° clockwise in sprite selection:
    // When I want 'up', use 'left' (because 'left' sprite shows as 'up')
    // When I want 'down', use 'right'
    // When I want 'left', use 'down'
    // When I want 'right', use 'up'
    // Same for diagonals - rotate 90° CW

    if (angle >= -22.5 && angle < 22.5) return 'up';           // moving right -> sprite up
    if (angle >= 22.5 && angle < 67.5) return 'up_left';       // moving down-right -> sprite up_left
    if (angle >= 67.5 && angle < 112.5) return 'left';         // moving down -> sprite left
    if (angle >= 112.5 && angle < 157.5) return 'down_left';   // moving down-left -> sprite down_left
    if (angle >= 157.5 || angle < -157.5) return 'down';       // moving left -> sprite down
    if (angle >= -157.5 && angle < -112.5) return 'down_right';// moving up-left -> sprite down_right
    if (angle >= -112.5 && angle < -67.5) return 'right';      // moving up -> sprite right
    if (angle >= -67.5 && angle < -22.5) return 'up_right';    // moving up-right -> sprite up_right

    return 'down'; // Default
  }

  private updateShadowPosition(): void {
    // Shadow follows player position - offset puts shadow at spider's "feet"
    // Spider sprite is 256x256 scaled to 0.5, so offset of 25 places shadow near ground
    this.playerShadow.setPosition(this.player.x, this.player.y + 25);
  }

  private handlePlayerAutoAttack(time: number): void {
    // Check attack cooldown
    const attackCooldown = 1000 / this.playerAttackSpeed;
    if (time - this.lastPlayerAttackTime < attackCooldown) {
      return;
    }

    // Find nearest enemy in range (priority target)
    let nearestEnemy: Phaser.Physics.Arcade.Sprite | null = null;
    let nearestEnemyDistance = this.playerAttackRange;

    this.enemies.getChildren().forEach((enemy) => {
      const sprite = enemy as Phaser.Physics.Arcade.Sprite;
      if (sprite.getData('state') === 'dead') return;

      const distance = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        sprite.x,
        sprite.y
      );

      if (distance < nearestEnemyDistance) {
        nearestEnemyDistance = distance;
        nearestEnemy = sprite;
      }
    });

    // Attack enemy if found (priority)
    if (nearestEnemy) {
      this.playerAttack(nearestEnemy);
      this.lastPlayerAttackTime = time;
      return;
    }

    // Check for towers in range (second priority after enemies)
    let nearestTower: Phaser.Physics.Arcade.Sprite | null = null;
    let nearestTowerDistance = this.playerAttackRange;

    this.towers.getChildren().forEach((towerObj) => {
      const tower = towerObj as Phaser.Physics.Arcade.Sprite;
      if (tower.getData('state') === 'destroyed') return;

      const distance = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        tower.x,
        tower.y
      );

      if (distance < nearestTowerDistance) {
        nearestTowerDistance = distance;
        nearestTower = tower;
      }
    });

    if (nearestTower) {
      this.playerAttackStructure(nearestTower);
      this.lastPlayerAttackTime = time;
      return;
    }

    // Check for houses in range (third priority)
    let nearestHouse: Phaser.Physics.Arcade.Sprite | null = null;
    let nearestHouseDistance = this.playerAttackRange;

    this.houses.getChildren().forEach((houseObj) => {
      const house = houseObj as Phaser.Physics.Arcade.Sprite;
      if (house.getData('state') === 'destroyed') return;

      const distance = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        house.x,
        house.y
      );

      if (distance < nearestHouseDistance) {
        nearestHouseDistance = distance;
        nearestHouse = house;
      }
    });

    if (nearestHouse) {
      this.playerAttackStructure(nearestHouse);
      this.lastPlayerAttackTime = time;
      return;
    }

    // If no enemies or structures, check for resource deposits in range
    let nearestDeposit: Phaser.Physics.Arcade.Sprite | null = null;
    let nearestDepositDistance = this.playerAttackRange;

    this.resourceDeposits.getChildren().forEach((deposit) => {
      const sprite = deposit as Phaser.Physics.Arcade.Sprite;

      const distance = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        sprite.x,
        sprite.y
      );

      if (distance < nearestDepositDistance) {
        nearestDepositDistance = distance;
        nearestDeposit = sprite;
      }
    });

    // Attack deposit if found
    if (nearestDeposit) {
      this.playerAttackDeposit(nearestDeposit);
      this.lastPlayerAttackTime = time;
    }
  }

  private playerAttack(enemy: Phaser.Physics.Arcade.Sprite): void {
    const damage = this.playerDamage;

    // Determine direction to enemy using 8-directional
    const dx = enemy.x - this.player.x;
    const dy = enemy.y - this.player.y;
    this.playerDirection = this.getDirectionFromVelocity(dx, dy);

    // Play attack animation (body + shadow)
    this.isPlayerAttacking = true;
    this.player.play(`spider_attack_${this.playerDirection}`, true);
    this.playerShadow.play(`spider_attack_shadow_${this.playerDirection}`, true);

    // Deal damage
    this.dealDamageToEnemy(enemy, damage);

    // Attack line effect
    this.showDustEffect(enemy.x, enemy.y);
  }

  private playerAttackStructure(structure: Phaser.Physics.Arcade.Sprite): void {
    const damage = this.playerDamage;
    const currentHealth = structure.getData('health') as number;
    const newHealth = Math.max(0, currentHealth - damage);
    structure.setData('health', newHealth);

    const maxHealth = structure.getData('maxHealth') as number;
    const structureId = structure.getData('id') as string;
    const structureType = structure.getData('type') as string;

    // Determine direction to structure
    const dx = structure.x - this.player.x;
    const dy = structure.y - this.player.y;
    this.playerDirection = this.getDirectionFromVelocity(dx, dy);

    // Play attack animation
    this.isPlayerAttacking = true;
    this.player.play(`spider_attack_${this.playerDirection}`, true);
    this.playerShadow.play(`spider_attack_shadow_${this.playerDirection}`, true);

    // Emit health changed event for HP bar
    gameEvents.emit('entity:health-changed', {
      entityId: structureId,
      x: structure.x,
      y: structure.y - 40,
      current: newHealth,
      max: maxHealth,
    });

    // Show damage number
    gameEvents.emit('combat:damage', {
      x: structure.x,
      y: structure.y,
      damage: damage,
      isCritical: false,
    });

    // Visual feedback - flash
    structure.setTint(0xffffff);
    this.time.delayedCall(100, () => {
      if (structure.active && structure.getData('state') === 'active') {
        // Restore original tint
        if (structureType === 'tower') {
          structure.setTint(0x8b4513);
        } else {
          structure.setTint(0x885533);
        }
      }
    });

    // Dust effect on hit
    this.showDustEffect(structure.x, structure.y);

    // Check if structure is destroyed
    if (newHealth <= 0) {
      this.destroyStructure(structure);
    }
  }

  private destroyStructure(structure: Phaser.Physics.Arcade.Sprite): void {
    const structureId = structure.getData('id') as string;
    const structureType = structure.getData('type') as string;
    const expReward = structure.getData('expReward') as number;
    const loot = structure.getData('loot') as { scrap: { min: number; max: number; chance: number }; polymer: { min: number; max: number; chance: number }; gems: { min: number; max: number; chance: number } };

    // Mark as destroyed
    structure.setData('state', 'destroyed' as StructureState);

    // Award XP
    gameEvents.emit('player:exp-gained', { amount: expReward });

    // Show XP text
    this.showFloatingText(structure.x, structure.y - 30, `+${expReward} XP`, 0x00ffff);

    // Emit structure destroyed event for quest system
    gameEvents.emit('structure:destroyed', {
      structureType: structureType,
      structureId: structureId,
      position: { x: structure.x, y: structure.y }
    });

    // Drop loot
    this.dropLootFromTable(structure.x, structure.y, loot);

    // Destroy HP bar
    const hpBar = this.hpBarsGraphics.get(structureId);
    if (hpBar) {
      hpBar.destroy();
      this.hpBarsGraphics.delete(structureId);
    }

    // Remove label
    const label = this.depositLabels.get(structureId);
    if (label) {
      label.destroy();
      this.depositLabels.delete(structureId);
    }

    // Create destruction dust effects covering the building
    this.createBuildingDestructionEffect(structure.x, structure.y, structureType);

    // Switch to destroyed sprite if available, otherwise fade out
    const destroyedTextureKey = this.getDestroyedTextureKey(structureType);
    if (destroyedTextureKey && this.textures.exists(destroyedTextureKey)) {
      // Delay the texture switch to sync with dust effect
      this.time.delayedCall(300, () => {
        structure.setTexture(destroyedTextureKey);
        structure.setTint(0xffffff); // Clear any tint
        structure.setAlpha(0.9);
      });
    } else {
      // Fallback: tint and fade out
      structure.setTint(0x333333);
      this.tweens.add({
        targets: structure,
        alpha: 0.3,
        duration: 1000,
      });
    }
  }

  private getDestroyedTextureKey(structureType: string): string | null {
    // Map structure types to their destroyed sprite keys
    switch (structureType) {
      case 'tower':
        return 'building_red_tower_destroyed';
      case 'house':
        return 'building_red_house_destroyed';
      // Castle would use 'building_red_castle_destroyed' if we add castles
      default:
        return null;
    }
  }

  private createBuildingDestructionEffect(x: number, y: number, structureType: string): void {
    // Create multiple dust effects to cover the building during collapse
    const dustCount = structureType === 'tower' ? 6 : 4;
    const spreadX = structureType === 'tower' ? 30 : 40;
    const spreadY = structureType === 'tower' ? 50 : 30;

    // Spawn dust clouds with slight delays for staggered effect
    for (let i = 0; i < dustCount; i++) {
      this.time.delayedCall(i * 80, () => {
        const offsetX = (Math.random() - 0.5) * spreadX * 2;
        const offsetY = (Math.random() - 0.5) * spreadY * 2;

        if (this.anims.exists('dust_anim')) {
          const dust = this.add.sprite(x + offsetX, y + offsetY, 'effect_dust1');
          dust.setScale(1.2 + Math.random() * 0.5);
          dust.setDepth(100);
          dust.setAlpha(0.9);
          dust.play('dust_anim');
          dust.once('animationcomplete', () => dust.destroy());
        } else {
          // Fallback dust particles
          const dustCloud = this.add.circle(x + offsetX, y + offsetY, 15, 0x8b7355, 0.7);
          dustCloud.setDepth(100);
          this.tweens.add({
            targets: dustCloud,
            scaleX: 2.5,
            scaleY: 2.5,
            alpha: 0,
            duration: 400,
            onComplete: () => dustCloud.destroy(),
          });
        }
      });
    }

    // Also play a small explosion in the center
    if (this.anims.exists('explosion_anim')) {
      this.time.delayedCall(200, () => {
        const explosion = this.add.sprite(x, y, 'effect_explosion1');
        explosion.setScale(0.6);
        explosion.setDepth(101);
        explosion.play('explosion_anim');
        explosion.once('animationcomplete', () => explosion.destroy());
      });
    }
  }

  private createDestructionEffect(x: number, y: number, color: number): void {
    // Play explosion animation if available
    if (this.anims.exists('explosion_anim')) {
      const explosion = this.add.sprite(x, y, 'effect_explosion1');
      explosion.setScale(0.8);
      explosion.setDepth(100);
      explosion.play('explosion_anim');
      explosion.once('animationcomplete', () => explosion.destroy());
    }

    // Create particles flying out
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const particle = this.add.circle(x, y, 5, color);
      particle.setDepth(100);

      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * 50,
        y: y + Math.sin(angle) * 50,
        alpha: 0,
        scale: 0,
        duration: 500,
        ease: 'Power2',
        onComplete: () => particle.destroy(),
      });
    }

    // Add dust clouds around destruction
    for (let i = 0; i < 3; i++) {
      this.time.delayedCall(i * 100, () => {
        const offsetX = Phaser.Math.Between(-30, 30);
        const offsetY = Phaser.Math.Between(-30, 30);
        this.showDustEffect(x + offsetX, y + offsetY);
      });
    }
  }

  private dropLootFromTable(x: number, y: number, lootTable: { scrap: { min: number; max: number; chance: number }; polymer: { min: number; max: number; chance: number }; gems: { min: number; max: number; chance: number } }): void {
    // Drop scrap
    if (Math.random() < lootTable.scrap.chance) {
      const amount = Phaser.Math.Between(lootTable.scrap.min, lootTable.scrap.max);
      for (let i = 0; i < amount; i++) {
        this.time.delayedCall(i * 30, () => {
          this.spawnResource(
            x + Phaser.Math.Between(-30, 30),
            y + Phaser.Math.Between(-30, 30),
            'scrap',
            1
          );
        });
      }
    }

    // Drop polymer
    if (Math.random() < lootTable.polymer.chance) {
      const amount = Phaser.Math.Between(lootTable.polymer.min, lootTable.polymer.max);
      for (let i = 0; i < amount; i++) {
        this.time.delayedCall(i * 30, () => {
          this.spawnResource(
            x + Phaser.Math.Between(-30, 30),
            y + Phaser.Math.Between(-30, 30),
            'polymer',
            1
          );
        });
      }
    }

    // Drop gems
    if (Math.random() < lootTable.gems.chance) {
      const amount = Phaser.Math.Between(lootTable.gems.min, lootTable.gems.max);
      for (let i = 0; i < amount; i++) {
        this.time.delayedCall(i * 30, () => {
          this.spawnResource(
            x + Phaser.Math.Between(-30, 30),
            y + Phaser.Math.Between(-30, 30),
            'gems',
            1
          );
        });
      }
    }
  }

  private playerAttackDeposit(deposit: Phaser.Physics.Arcade.Sprite): void {
    const damage = this.playerDamage;
    const currentHealth = deposit.getData('health') as number;
    const newHealth = Math.max(0, currentHealth - damage);
    deposit.setData('health', newHealth);

    const maxHealth = deposit.getData('maxHealth') as number;
    const depositId = deposit.getData('id') as string;
    const resourceType = deposit.getData('resourceType') as string;

    // Determine direction to deposit using 8-directional
    const dx = deposit.x - this.player.x;
    const dy = deposit.y - this.player.y;
    this.playerDirection = this.getDirectionFromVelocity(dx, dy);

    // Play attack animation (body + shadow)
    this.isPlayerAttacking = true;
    this.player.play(`spider_attack_${this.playerDirection}`, true);
    this.playerShadow.play(`spider_attack_shadow_${this.playerDirection}`, true);

    // Emit health changed event for HP bar
    gameEvents.emit('entity:health-changed', {
      entityId: depositId,
      x: deposit.x,
      y: deposit.y - 30,
      current: newHealth,
      max: maxHealth,
    });

    // Show damage number
    gameEvents.emit('combat:damage', {
      x: deposit.x,
      y: deposit.y,
      damage: damage,
      isCritical: false,
    });

    // Visual feedback - flash deposit
    deposit.setTint(0xffffff);
    this.time.delayedCall(100, () => {
      if (deposit.active) {
        deposit.clearTint();
      }
    });

    // Dust effect on hit
    this.showDustEffect(deposit.x, deposit.y);

    // Drop small amount of resources on each hit
    if (Math.random() < 0.3) {
      this.spawnResource(
        deposit.x + Phaser.Math.Between(-15, 15),
        deposit.y + Phaser.Math.Between(-15, 15),
        resourceType,
        1
      );
    }

    // Check if deposit is depleted
    if (newHealth <= 0) {
      this.depleteDeposit(deposit);
    }
  }

  private depleteDeposit(deposit: Phaser.Physics.Arcade.Sprite): void {
    const resourceType = deposit.getData('resourceType') as string;
    const resourceAmount = deposit.getData('resourceAmount') as number;
    const depositId = deposit.getData('id') as string;

    // Drop remaining resources
    for (let i = 0; i < resourceAmount; i++) {
      this.time.delayedCall(i * 50, () => {
        if (deposit.active) {
          this.spawnResource(
            deposit.x + Phaser.Math.Between(-25, 25),
            deposit.y + Phaser.Math.Between(-25, 25),
            resourceType,
            1
          );
        }
      });
    }

    // Show floating text
    this.showFloatingText(deposit.x, deposit.y - 20, `+${resourceAmount} ${resourceType}`, this.getResourceColor(resourceType));

    // Remove HP bar
    this.removeHpBar(depositId);

    // Remove label
    const label = this.depositLabels.get(depositId);
    if (label) {
      label.destroy();
      this.depositLabels.delete(depositId);
    }

    // Destroy deposit with effect
    this.tweens.add({
      targets: deposit,
      alpha: 0,
      scale: 0.5,
      duration: 300,
      onComplete: () => {
        deposit.destroy();
      },
    });

    // Emit deposit depleted event
    gameEvents.emit('deposit:depleted', {
      depositId: depositId,
      resourceType: resourceType,
      position: { x: deposit.x, y: deposit.y },
    });
  }

  private dealDamageToEnemy(enemy: Phaser.Physics.Arcade.Sprite, damage: number): void {
    const currentHealth = enemy.getData('health') as number;
    const newHealth = Math.max(0, currentHealth - damage);
    enemy.setData('health', newHealth);

    const maxHealth = enemy.getData('maxHealth') as number;
    const enemyId = enemy.getData('id') as string;

    // Emit health changed event
    gameEvents.emit('entity:health-changed', {
      entityId: enemyId,
      x: enemy.x,
      y: enemy.y - 20,
      current: newHealth,
      max: maxHealth,
    });

    // Show damage number
    gameEvents.emit('combat:damage', {
      x: enemy.x,
      y: enemy.y,
      damage: damage,
      isCritical: false,
    });

    // Flash enemy red
    enemy.setTint(0xff0000);
    this.time.delayedCall(100, () => {
      if (enemy.active) {
        enemy.clearTint();
      }
    });

    // Dust effect on damage
    this.showDustEffect(enemy.x, enemy.y);

    // Check death
    if (newHealth <= 0) {
      this.killEnemy(enemy);
    }
  }

  private killEnemy(enemy: Phaser.Physics.Arcade.Sprite): void {
    enemy.setData('state', 'dead' as EnemyState);
    enemy.setVelocity(0, 0);

    const enemyId = enemy.getData('id') as string;
    const expReward = enemy.getData('expReward') as number;

    // Death dust effect
    this.createDeathDustEffect(enemy.x, enemy.y);

    // Remove HP bar
    this.removeHpBar(enemyId);

    // Emit death event
    gameEvents.emit('entity:died', {
      entityId: enemyId,
      entityType: 'enemy',
      position: { x: enemy.x, y: enemy.y },
    });

    // Give XP
    gameEvents.emit('player:exp-gained', {
      amount: expReward,
      total: expReward, // Will be managed by store
      toNext: 100,
    });

    // Show XP floating text
    this.showFloatingText(enemy.x, enemy.y - 20, `+${expReward} XP`, 0x44aaff);

    // Drop loot
    this.dropLoot(enemy.x, enemy.y);

    // Create corpse (for soul draining later)
    this.createCorpse(enemy.x, enemy.y, enemyId);

    // Decrement spawn point counter
    const spawnPointIndex = enemy.getData('spawnPointIndex') as number | undefined;
    if (spawnPointIndex !== undefined && this.spawnPoints[spawnPointIndex]) {
      this.spawnPoints[spawnPointIndex].currentEnemies--;
      // Start respawn timer
      this.spawnPoints[spawnPointIndex].respawnTimer = Phaser.Math.Between(5000, 10000);
    }

    // Destroy enemy sprite
    enemy.destroy();
  }

  private dropLoot(x: number, y: number): void {
    // Random loot drop
    const lootTable = [
      { type: 'scrap', chance: 0.8, min: 5, max: 15 },
      { type: 'polymer', chance: 0.3, min: 1, max: 5 },
      { type: 'gems', chance: 0.05, min: 1, max: 2 },
    ];

    lootTable.forEach((loot) => {
      if (Math.random() < loot.chance) {
        const amount = Phaser.Math.Between(loot.min, loot.max);
        this.spawnResource(
          x + Phaser.Math.Between(-20, 20),
          y + Phaser.Math.Between(-20, 20),
          loot.type,
          amount
        );
      }
    });
  }

  private spawnResource(x: number, y: number, type: string, amount: number): void {
    // Map resource type to Tiny Swords sprites
    const resourceSpriteMap: Record<string, string> = {
      scrap: 'resource_meat',
      polymer: 'resource_wood',
      gems: 'resource_gold',
      souls: 'skull_idle', // Use spritesheet with first frame
    };
    const textureName = resourceSpriteMap[type] || `${type}_placeholder`;
    const resource = this.physics.add.sprite(x, y, textureName);

    // For souls (skull), set specific frame since it's a spritesheet
    if (type === 'souls') {
      resource.setFrame(0);
      resource.setScale(0.25); // Skull is 192x192
    } else {
      // Scale resources appropriately (Tiny Swords resources are ~128x128)
      resource.setScale(0.4);
    }
    resource.setData('resourceType', type);
    resource.setData('amount', amount);
    resource.setData('canBeMagnetized', false); // Can't be magnetized until scatter is done
    resource.setDepth(3);

    // Random scatter direction and distance (farther than before)
    const scatterAngle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const scatterDistance = Phaser.Math.Between(40, 80); // Farther scatter distance
    const targetX = x + Math.cos(scatterAngle) * scatterDistance;
    const targetY = y + Math.sin(scatterAngle) * scatterDistance;

    // Scatter animation with arc
    const scatterDuration = 400;
    this.tweens.add({
      targets: resource,
      x: targetX,
      duration: scatterDuration,
      ease: 'Quad.easeOut',
    });
    this.tweens.add({
      targets: resource,
      y: targetY - 30, // Arc up
      duration: scatterDuration / 2,
      ease: 'Quad.easeOut',
      yoyo: true,
      onComplete: () => {
        // After scatter, enable magnetization
        if (resource.active) {
          resource.setData('canBeMagnetized', true);
        }
      },
    });

    // Resource magnet effect - move toward player if close AND scatter is done
    this.time.addEvent({
      delay: 100,
      loop: true,
      callback: () => {
        if (!resource.active) return;
        if (!resource.getData('canBeMagnetized')) return; // Wait for scatter to finish

        const distance = Phaser.Math.Distance.Between(
          resource.x,
          resource.y,
          this.player.x,
          this.player.y
        );

        if (distance < GAME_CONFIG.RESOURCE_MAGNET_RADIUS) {
          const angle = Phaser.Math.Angle.Between(
            resource.x,
            resource.y,
            this.player.x,
            this.player.y
          );
          resource.setVelocity(
            Math.cos(angle) * GAME_CONFIG.DROPPED_RESOURCE_SPEED,
            Math.sin(angle) * GAME_CONFIG.DROPPED_RESOURCE_SPEED
          );
        }
      },
    });

    // Auto destroy after lifetime
    this.time.delayedCall(GAME_CONFIG.RESOURCE_LIFETIME, () => {
      if (resource.active) {
        resource.destroy();
      }
    });

    this.droppedResources.add(resource);
  }

  private createCorpse(x: number, y: number, originalId: string): void {
    // Use dead knight sprite for corpses
    const textureName = this.textures.exists('enemy_dead') ? 'enemy_dead' : 'corpse_placeholder';
    const corpse = this.physics.add.sprite(x, y, textureName);
    corpse.setData('type', 'corpse');
    corpse.setData('originalId', originalId);
    corpse.setData('soulValue', 1);
    corpse.setDepth(2);
    corpse.setScale(0.5); // Scale for dead knight sprite (128x128)

    // Spawn animation: scale up from 0 with slight bounce
    corpse.setScale(0);
    corpse.setAlpha(0);
    this.tweens.add({
      targets: corpse,
      scale: 0.5,
      alpha: 0.9,
      duration: 300,
      ease: 'Back.easeOut',
    });

    // Play dead knight animation if available
    if (this.anims.exists('enemy_dead_anim')) {
      corpse.play('enemy_dead_anim');
    }

    // Destroy after lifetime
    this.time.delayedCall(GAME_CONFIG.CORPSE_LIFETIME, () => {
      if (corpse.active) {
        // Fade out
        this.tweens.add({
          targets: corpse,
          alpha: 0,
          scale: 0.2,
          duration: 500,
          onComplete: () => corpse.destroy(),
        });
      }
    });

    this.corpses.add(corpse);
  }

  // ========== ENEMY AI SYSTEM ==========
  // State machine for enemy behavior: idle, chase, attack, flee, dead
  // Handles target finding, movement, attacking, and special abilities

  private updateEnemies(time: number): void {
    this.enemies.getChildren().forEach((enemy) => {
      const sprite = enemy as Phaser.Physics.Arcade.Sprite;
      const state = sprite.getData('state') as EnemyState;

      if (state === 'dead') return;

      // Check stun status
      const isStunned = sprite.getData('isStunned') as boolean;
      if (isStunned) {
        const stunEndTime = sprite.getData('stunEndTime') as number;
        if (time >= stunEndTime) {
          sprite.setData('isStunned', false);
          const enemyType = sprite.getData('enemyType') as EnemyType;
          this.setEnemyTint(sprite, enemyType);
        } else {
          // Stunned - can't do anything
          sprite.setVelocity(0, 0);
          return;
        }
      }

      // Check mind control status
      const isMindControlled = sprite.getData('isMindControlled') as boolean;
      if (isMindControlled) {
        const mindControlEndTime = sprite.getData('mindControlEndTime') as number;
        if (time >= mindControlEndTime) {
          sprite.setData('isMindControlled', false);
          const enemyType = sprite.getData('enemyType') as EnemyType;
          this.setEnemyTint(sprite, enemyType);
        } else {
          // Mind controlled - attack other enemies
          this.updateMindControlledEnemy(sprite, time);
          return;
        }
      }

      const aggroRadius = sprite.getData('aggroRadius') as number;
      const attackRange = sprite.getData('attackRange') as number;
      const moveSpeed = sprite.getData('moveSpeed') as number;
      const behavior = sprite.getData('behavior') as EnemyBehavior;
      const attackType = sprite.getData('attackType') as string || 'melee';
      const enemyType = sprite.getData('enemyType') as EnemyType;

      // Find nearest target (player or unit)
      let nearestTarget: Phaser.Physics.Arcade.Sprite | null = null;
      let nearestDistance = aggroRadius;

      // Check player distance
      const playerDistance = Phaser.Math.Distance.Between(
        sprite.x,
        sprite.y,
        this.player.x,
        this.player.y
      );
      if (playerDistance < nearestDistance) {
        nearestDistance = playerDistance;
        nearestTarget = this.player;
      }

      // Check units distance
      this.units.getChildren().forEach((unitObj) => {
        const unit = unitObj as Phaser.Physics.Arcade.Sprite;
        if (unit.getData('state') === 'dead') return;

        const unitDistance = Phaser.Math.Distance.Between(sprite.x, sprite.y, unit.x, unit.y);
        if (unitDistance < nearestDistance) {
          nearestDistance = unitDistance;
          nearestTarget = unit;
        }
      });

      // Store current target
      sprite.setData('currentTarget', nearestTarget);

      // State machine with behavior modifiers
      switch (state) {
        case 'idle':
          sprite.setVelocity(0, 0);
          if (nearestTarget && nearestDistance < aggroRadius) {
            // Cowards flee instead of chasing
            if (behavior === 'coward') {
              sprite.setData('state', 'flee' as EnemyState);
            } else {
              sprite.setData('state', 'chase' as EnemyState);
            }
          }
          break;

        case 'flee':
          // Coward behavior - run away from threats, but fight back if caught
          if (!nearestTarget || nearestDistance > aggroRadius * 2) {
            sprite.setData('state', 'idle' as EnemyState);
            sprite.setData('cornered', false);
            sprite.setVelocity(0, 0);
          } else if (nearestDistance <= attackRange) {
            // Player caught up - fight back!
            sprite.setData('state', 'attack' as EnemyState);
            sprite.setVelocity(0, 0);
            // Face the attacker
            sprite.setFlipX(nearestTarget.x < sprite.x);
            // Immediately attack
            this.enemyAttack(sprite, nearestTarget, time);
          } else {
            // Run away from target
            const fleeAngle = Phaser.Math.Angle.Between(
              nearestTarget.x,
              nearestTarget.y,
              sprite.x,
              sprite.y
            );
            sprite.setVelocity(
              Math.cos(fleeAngle) * moveSpeed * 1.2, // Run faster when fleeing
              Math.sin(fleeAngle) * moveSpeed * 1.2
            );
            sprite.setFlipX(nearestTarget.x > sprite.x);

            // If cornered (at world bounds or blocked by obstacle), turn and fight
            const body = sprite.body as Phaser.Physics.Arcade.Body;
            if (body.blocked.left || body.blocked.right || body.blocked.up || body.blocked.down) {
              sprite.setData('state', 'attack' as EnemyState);
              sprite.setData('cornered', true); // Mark as cornered so attack state knows
            }
          }
          break;

        case 'chase':
          if (!nearestTarget || nearestDistance > aggroRadius * 1.5) {
            sprite.setData('state', 'idle' as EnemyState);
            sprite.setVelocity(0, 0);
          } else if (nearestDistance <= attackRange) {
            // In attack range - switch to attack AND immediately try to attack
            sprite.setData('state', 'attack' as EnemyState);
            sprite.setVelocity(0, 0);
            // Immediately attack (don't wait for next frame)
            this.enemyAttack(sprite, nearestTarget, time);
          } else {
            // Ranged enemies try to maintain distance
            if (attackType === 'ranged' && nearestDistance < attackRange * 0.5) {
              // Too close - back away
              const retreatAngle = Phaser.Math.Angle.Between(
                nearestTarget.x,
                nearestTarget.y,
                sprite.x,
                sprite.y
              );
              sprite.setVelocity(
                Math.cos(retreatAngle) * moveSpeed * 0.8,
                Math.sin(retreatAngle) * moveSpeed * 0.8
              );
            } else {
              // Move toward target
              const angle = Phaser.Math.Angle.Between(
                sprite.x,
                sprite.y,
                nearestTarget.x,
                nearestTarget.y
              );
              sprite.setVelocity(Math.cos(angle) * moveSpeed, Math.sin(angle) * moveSpeed);
            }

            // Face target
            sprite.setFlipX(nearestTarget.x < sprite.x);
          }
          break;

        case 'attack':
          {
            const isCornered = sprite.getData('cornered') as boolean;

            // Cornered cowards need to approach their target to attack
            if (isCornered && nearestTarget && nearestDistance > attackRange) {
              // Move toward target to get in attack range
              const angle = Phaser.Math.Angle.Between(
                sprite.x,
                sprite.y,
                nearestTarget.x,
                nearestTarget.y
              );
              sprite.setVelocity(Math.cos(angle) * moveSpeed, Math.sin(angle) * moveSpeed);
              sprite.setFlipX(nearestTarget.x < sprite.x);
            } else if (attackType === 'ranged' && nearestTarget && nearestDistance < attackRange * 0.4) {
              // Ranged units back away while attacking
              const retreatAngle = Phaser.Math.Angle.Between(
                nearestTarget.x,
                nearestTarget.y,
                sprite.x,
                sprite.y
              );
              sprite.setVelocity(
                Math.cos(retreatAngle) * moveSpeed * 0.5,
                Math.sin(retreatAngle) * moveSpeed * 0.5
              );
            } else {
              sprite.setVelocity(0, 0);
            }

            // If no target, go back to appropriate state
            if (!nearestTarget) {
              sprite.setData('cornered', false);
              if (behavior === 'coward') {
                sprite.setData('state', 'flee' as EnemyState);
              } else {
                sprite.setData('state', 'chase' as EnemyState);
              }
            } else if (!isCornered && nearestDistance > attackRange * 1.5) {
              // Regular enemies go back to chase if out of range
              // Cornered cowards stay aggressive
              if (behavior === 'coward') {
                sprite.setData('state', 'flee' as EnemyState);
              } else {
                sprite.setData('state', 'chase' as EnemyState);
              }
            } else if (nearestDistance <= attackRange) {
              // In range - attack!
              this.enemyAttack(sprite, nearestTarget, time);
            }
            // else: cornered and approaching target, continue moving
          }
          break;
      }

      // Separation behavior: push apart from nearby enemies
      this.applyEnemySeparation(sprite);
    });
  }

  private applyEnemySeparation(sprite: Phaser.Physics.Arcade.Sprite): void {
    const separationRadius = 30;
    const separationForce = 20;

    this.enemies.getChildren().forEach((otherObj) => {
      const other = otherObj as Phaser.Physics.Arcade.Sprite;
      if (other === sprite || other.getData('state') === 'dead') return;

      const dx = sprite.x - other.x;
      const dy = sprite.y - other.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < separationRadius && distance > 0) {
        // Normalize and apply separation
        const factor = (separationRadius - distance) / separationRadius;
        const body = sprite.body as Phaser.Physics.Arcade.Body;
        body.velocity.x += (dx / distance) * separationForce * factor;
        body.velocity.y += (dy / distance) * separationForce * factor;
      }
    });
  }

  private updateMindControlledEnemy(sprite: Phaser.Physics.Arcade.Sprite, time: number): void {
    const attackRange = sprite.getData('attackRange') as number;
    const moveSpeed = sprite.getData('moveSpeed') as number;
    const aggroRadius = sprite.getData('aggroRadius') as number;

    // Find nearest non-controlled enemy to attack
    let nearestEnemy: Phaser.Physics.Arcade.Sprite | null = null;
    let nearestDistance = aggroRadius * 2;

    this.enemies.getChildren().forEach((enemyObj) => {
      const enemy = enemyObj as Phaser.Physics.Arcade.Sprite;
      if (enemy === sprite) return; // Don't target self
      if (enemy.getData('state') === 'dead') return;
      if (enemy.getData('isMindControlled')) return; // Don't target other controlled enemies

      const dist = Phaser.Math.Distance.Between(sprite.x, sprite.y, enemy.x, enemy.y);
      if (dist < nearestDistance) {
        nearestDistance = dist;
        nearestEnemy = enemy;
      }
    });

    if (nearestEnemy) {
      const target = nearestEnemy as Phaser.Physics.Arcade.Sprite;
      if (nearestDistance <= attackRange) {
        // Attack
        sprite.setVelocity(0, 0);
        this.mindControlledEnemyAttack(sprite, target, time);
      } else {
        // Chase
        const angle = Phaser.Math.Angle.Between(
          sprite.x,
          sprite.y,
          target.x,
          target.y
        );
        sprite.setVelocity(Math.cos(angle) * moveSpeed, Math.sin(angle) * moveSpeed);
        sprite.setFlipX(target.x < sprite.x);
      }
    } else {
      // No targets - follow player
      const playerDistance = Phaser.Math.Distance.Between(sprite.x, sprite.y, this.player.x, this.player.y);
      if (playerDistance > 100) {
        const angle = Phaser.Math.Angle.Between(sprite.x, sprite.y, this.player.x, this.player.y);
        sprite.setVelocity(Math.cos(angle) * moveSpeed * 0.5, Math.sin(angle) * moveSpeed * 0.5);
      } else {
        sprite.setVelocity(0, 0);
      }
    }
  }

  private mindControlledEnemyAttack(attacker: Phaser.Physics.Arcade.Sprite, target: Phaser.Physics.Arcade.Sprite, time: number): void {
    const attackSpeed = attacker.getData('attackSpeed') as number;
    const lastAttackTime = attacker.getData('lastAttackTime') as number;
    const attackCooldown = 1000 / attackSpeed;

    if (time - lastAttackTime < attackCooldown) return;

    const damage = attacker.getData('damage') as number;
    attacker.setData('lastAttackTime', time);

    // Deal damage to target enemy
    this.dealDamageToEnemy(target, damage);

    // Visual feedback
    attacker.setTint(0xffaaff); // Pink-purple flash
    this.time.delayedCall(100, () => {
      if (attacker.active && attacker.getData('isMindControlled')) {
        attacker.setTint(0xaa66ff); // Back to controlled purple
      }
    });

    // Attack line
    this.showDustEffect(target.x, target.y);
  }

  private enemyAttack(enemy: Phaser.Physics.Arcade.Sprite, target: Phaser.Physics.Arcade.Sprite, time: number): void {
    const attackSpeed = enemy.getData('attackSpeed') as number;
    const lastAttackTime = enemy.getData('lastAttackTime') as number;
    const attackCooldown = 1000 / attackSpeed;
    const enemyType = enemy.getData('enemyType') as EnemyType;

    if (time - lastAttackTime < attackCooldown) {
      return;
    }

    console.log(`[ENEMY ATTACK] ${enemyType} attacking! cooldown=${attackCooldown.toFixed(0)}ms`);

    const damage = enemy.getData('damage') as number;
    const attackType = enemy.getData('attackType') as string || 'melee';
    enemy.setData('lastAttackTime', time);

    // Stop moving during attack
    enemy.setVelocity(0, 0);

    // Play attack animation
    const attackAnimKey = `${enemyType}_attack`;
    if (this.anims.exists(attackAnimKey)) {
      enemy.play(attackAnimKey, true);
      // Return to idle after attack animation
      enemy.once('animationcomplete', () => {
        if (enemy.active) {
          const idleAnimKey = `${enemyType}_idle`;
          if (this.anims.exists(idleAnimKey)) {
            enemy.play(idleAnimKey, true);
          }
        }
      });
    }

    // Create dust effect on attack
    this.createAttackDustEffect(enemy.x, enemy.y);

    // Ranged enemies fire projectiles
    if (attackType === 'ranged') {
      // Monk (hunter_rifle) uses fire projectile, Archer uses arrow
      if (enemyType === 'hunter_rifle') {
        this.fireMonkProjectile(enemy.x, enemy.y, target, damage);
      } else if (enemyType === 'rogue_crossbow') {
        // Archer fires an arrow with attack animation
        this.fireArrowProjectile(enemy.x, enemy.y, target, damage);
      } else {
        const projectileColor = 0x66ff66; // Green for others
        this.fireProjectile(enemy.x, enemy.y, target, damage, projectileColor, 'enemy');
      }
    } else {
      // Melee instant damage
      const targetType = target.getData('type') as string;
      if (targetType === 'player') {
        this.dealDamageToPlayer(damage, enemy);
      } else if (targetType === 'unit') {
        this.dealDamageToUnit(target, damage);
      }
      // Flash target to show damage
      target.setTint(0xff0000);
      this.time.delayedCall(100, () => {
        if (target.active) {
          target.clearTint();
        }
      });
    }
  }

  private createAttackDustEffect(x: number, y: number): void {
    if (this.anims.exists('dust_anim')) {
      const dust = this.add.sprite(x, y + 20, 'effect_dust1');
      dust.setScale(0.6);
      dust.setDepth(49);
      dust.play('dust_anim');
      dust.once('animationcomplete', () => dust.destroy());
    }
  }

  private createDeathDustEffect(x: number, y: number): void {
    // Create larger dust cloud for death effect
    if (this.anims.exists('dust_anim')) {
      // Multiple dust particles spreading out
      for (let i = 0; i < 3; i++) {
        const offsetX = Phaser.Math.Between(-15, 15);
        const offsetY = Phaser.Math.Between(-10, 10);
        const delay = i * 50;

        this.time.delayedCall(delay, () => {
          const dust = this.add.sprite(x + offsetX, y + offsetY, 'effect_dust1');
          dust.setScale(0.8);
          dust.setDepth(49);
          dust.setAlpha(0.9);
          dust.play('dust_anim');
          dust.once('animationcomplete', () => dust.destroy());
        });
      }
    }
  }

  private fireProjectile(
    startX: number,
    startY: number,
    target: Phaser.Physics.Arcade.Sprite,
    damage: number,
    color: number,
    sourceType: 'enemy' | 'unit'
  ): void {
    // Create projectile sprite
    const projectile = this.add.circle(startX, startY, 4, color);
    projectile.setDepth(50);

    // Calculate travel time based on distance
    const distance = Phaser.Math.Distance.Between(startX, startY, target.x, target.y);
    const travelTime = Math.min(500, distance * 1.5); // Faster for closer targets

    // Store target reference for damage application
    const targetRef = target;
    const targetType = target.getData('type') as string;

    // Animate projectile flying to target
    this.tweens.add({
      targets: projectile,
      x: target.x,
      y: target.y,
      duration: travelTime,
      ease: 'Linear',
      onComplete: () => {
        // Apply damage when projectile arrives
        if (targetRef.active) {
          if (sourceType === 'enemy') {
            if (targetType === 'player') {
              this.dealDamageToPlayer(damage, targetRef);
            } else if (targetType === 'unit') {
              this.dealDamageToUnit(targetRef, damage);
            }
          } else if (sourceType === 'unit') {
            this.dealDamageToEnemy(targetRef, damage);
          }
        }
        // Impact effect
        this.createImpactEffect(projectile.x, projectile.y, color);
        projectile.destroy();
      },
    });
  }

  private createImpactEffect(x: number, y: number, color: number): void {
    const impact = this.add.circle(x, y, 6, color, 0.8);
    impact.setDepth(50);

    this.tweens.add({
      targets: impact,
      scaleX: 2,
      scaleY: 2,
      alpha: 0,
      duration: 150,
      onComplete: () => impact.destroy(),
    });
  }

  private fireMonkProjectile(
    startX: number,
    startY: number,
    target: Phaser.Physics.Arcade.Sprite,
    damage: number
  ): void {
    // Create fire sprite projectile for Monk
    let projectile: Phaser.GameObjects.Sprite | Phaser.GameObjects.Arc;

    if (this.anims.exists('fire_anim')) {
      projectile = this.add.sprite(startX, startY, 'effect_fire1');
      (projectile as Phaser.GameObjects.Sprite).play('fire_anim');
      projectile.setScale(0.8);
    } else {
      // Fallback to orange circle if fire animation not available
      projectile = this.add.circle(startX, startY, 6, 0xffaa00);
    }
    projectile.setDepth(50);

    // Calculate travel time based on distance
    const distance = Phaser.Math.Distance.Between(startX, startY, target.x, target.y);
    const travelTime = Math.min(600, distance * 1.8); // Slightly slower for dramatic effect

    // Store target reference for damage application
    const targetRef = target;
    const targetType = target.getData('type') as string;

    // Animate projectile flying to target
    this.tweens.add({
      targets: projectile,
      x: target.x,
      y: target.y,
      duration: travelTime,
      ease: 'Linear',
      onComplete: () => {
        // Apply damage when projectile arrives
        if (targetRef.active) {
          if (targetType === 'player') {
            this.dealDamageToPlayer(damage, targetRef);
          } else if (targetType === 'unit') {
            this.dealDamageToUnit(targetRef, damage);
          }
        }
        // Create explosion effect on impact
        this.createFireImpactEffect(projectile.x, projectile.y);
        projectile.destroy();
      },
    });
  }

  private createFireImpactEffect(x: number, y: number): void {
    // Try to use explosion animation, fallback to simple effect
    if (this.anims.exists('explosion_anim')) {
      const explosion = this.add.sprite(x, y, 'effect_explosion1');
      explosion.setScale(0.4);
      explosion.setDepth(51);
      explosion.play('explosion_anim');
      explosion.once('animationcomplete', () => explosion.destroy());
    } else {
      // Fallback orange impact
      const impact = this.add.circle(x, y, 12, 0xff6600, 0.9);
      impact.setDepth(51);
      this.tweens.add({
        targets: impact,
        scaleX: 2.5,
        scaleY: 2.5,
        alpha: 0,
        duration: 250,
        onComplete: () => impact.destroy(),
      });
    }
  }

  private fireArrowProjectile(
    startX: number,
    startY: number,
    target: Phaser.Physics.Arcade.Sprite,
    damage: number
  ): void {
    // Calculate angle to target (for arrow rotation)
    const angle = Phaser.Math.Angle.Between(startX, startY, target.x, target.y);

    // Create arrow sprite (64x128 spritesheet with 2 frames, arrow points right)
    let arrow: Phaser.GameObjects.Sprite | Phaser.GameObjects.Arc;
    const isArrowSprite = this.textures.exists('enemy_archer_arrow');
    if (isArrowSprite) {
      arrow = this.add.sprite(startX, startY, 'enemy_archer_arrow', 0); // Use first frame
      arrow.setScale(0.5);
      // Start with upward angle (arc start)
      arrow.setRotation(angle - Math.PI / 4);
    } else {
      // Fallback to brown circle
      arrow = this.add.circle(startX, startY, 5, 0x8b4513);
    }
    arrow.setDepth(50);

    // Calculate travel time based on distance
    const distance = Phaser.Math.Distance.Between(startX, startY, target.x, target.y);
    const travelTime = Math.min(600, distance * 1.5); // Slightly slower for arc effect

    // Store target position (in case target moves)
    const targetX = target.x;
    const targetY = target.y;
    const targetRef = target;
    const targetType = target.getData('type') as string;

    // Arc height - higher for longer distances
    const arcHeight = Math.min(80, distance * 0.3);
    const midY = Math.min(startY, targetY) - arcHeight;

    // Animate arrow flying in arc
    this.tweens.add({
      targets: arrow,
      x: targetX,
      duration: travelTime,
      ease: 'Linear',
    });

    // Y position follows arc (parabola)
    this.tweens.add({
      targets: arrow,
      y: { value: targetY, ease: 'Quad.easeIn' },
      duration: travelTime,
      onUpdate: () => {
        if (isArrowSprite && arrow instanceof Phaser.GameObjects.Sprite) {
          // Calculate progress
          const progress = (arrow.x - startX) / (targetX - startX);
          // Arc formula: y offset based on progress (parabola)
          const arcOffset = arcHeight * 4 * progress * (1 - progress);
          const baseY = startY + (targetY - startY) * progress;
          arrow.y = baseY - arcOffset;

          // Rotate arrow to follow trajectory
          // Derivative of arc: -arcHeight * 4 * (1 - 2*progress) + slope
          const slope = (targetY - startY) / (targetX - startX);
          const arcDerivative = -arcHeight * 4 * (1 - 2 * progress) / (targetX - startX);
          const trajectoryAngle = Math.atan(slope + arcDerivative);
          arrow.setRotation(trajectoryAngle + (targetX > startX ? 0 : Math.PI));
        }
      },
      onComplete: () => {
        // Check if target is still at the impact location (arrows can miss!)
        const hitRadius = 30; // How close target must be to get hit
        let didHit = false;

        if (targetRef.active) {
          const currentDistance = Phaser.Math.Distance.Between(
            targetX, targetY,
            targetRef.x, targetRef.y
          );

          if (currentDistance <= hitRadius) {
            // Target is still in the hit zone - apply damage
            didHit = true;
            if (targetType === 'player') {
              this.dealDamageToPlayer(damage, targetRef);
            } else if (targetType === 'unit') {
              this.dealDamageToUnit(targetRef, damage);
            }
          }
        }

        // Arrow sticks in ground (use no-tip version for missed shots)
        if (isArrowSprite && arrow instanceof Phaser.GameObjects.Sprite) {
          // Use frame 1 (no tip) for ground arrows, frame 0 still used during flight
          arrow.setFrame(1); // No-tip arrow for ground
          arrow.setRotation(Math.PI / 2); // Point downward
          arrow.setDepth(2); // Below entities
          arrow.setAlpha(0.7);

          // Fade out after a while
          this.time.delayedCall(3000, () => {
            if (arrow.active) {
              this.tweens.add({
                targets: arrow,
                alpha: 0,
                duration: 500,
                onComplete: () => arrow.destroy(),
              });
            }
          });
        } else {
          // Small dust impact for non-sprite arrows
          this.createArrowImpactEffect(arrow.x, arrow.y);
          arrow.destroy();
        }
      },
    });
  }

  private createArrowImpactEffect(x: number, y: number): void {
    // Small dust puff when arrow hits
    if (this.anims.exists('dust_anim')) {
      const dust = this.add.sprite(x, y, 'effect_dust1');
      dust.setScale(0.5);
      dust.setDepth(51);
      dust.play('dust_anim');
      dust.once('animationcomplete', () => dust.destroy());
    } else {
      // Fallback brown impact
      const impact = this.add.circle(x, y, 6, 0x8b4513, 0.7);
      impact.setDepth(51);
      this.tweens.add({
        targets: impact,
        scaleX: 1.5,
        scaleY: 1.5,
        alpha: 0,
        duration: 150,
        onComplete: () => impact.destroy(),
      });
    }
  }

  private dealDamageToPlayer(damage: number, _source: Phaser.Physics.Arcade.Sprite): void {
    // Check if player is dead or invincible
    if (this.player.getData('isDead') || this.player.getData('isInvincible')) {
      return;
    }

    const currentHealth = this.player.getData('health') as number;
    const maxHealth = this.player.getData('maxHealth') as number;
    const newHealth = Math.max(0, currentHealth - damage);
    this.player.setData('health', newHealth);

    // Emit health changed
    gameEvents.emit('player:health-changed', {
      current: newHealth,
      max: maxHealth,
    });

    // Show damage
    gameEvents.emit('combat:damage', {
      x: this.player.x,
      y: this.player.y,
      damage: damage,
      isCritical: false,
    });

    // Flash player
    this.player.setTint(0xff0000);
    this.time.delayedCall(100, () => {
      this.player.clearTint();
    });

    // Dust effect on damage
    this.showDustEffect(this.player.x, this.player.y);

    // Check death
    if (newHealth <= 0) {
      this.handlePlayerDeath();
    }
  }

  private handlePlayerDeath(): void {
    const deathX = this.player.x;
    const deathY = this.player.y;

    gameEvents.emit('player:died', {
      position: { x: deathX, y: deathY },
    });

    // Create corpse sprite at death location (visual only, no physics)
    const corpse = this.add.sprite(deathX, deathY, 'spider_idle_down');
    corpse.setScale(0.5);
    corpse.setDepth(5); // Below living entities
    corpse.setAlpha(0.7);
    corpse.setTint(0x666666); // Gray tint for corpse

    // Create corpse shadow
    const corpseShadow = this.add.sprite(deathX, deathY, 'spider_idle_shadow_down');
    corpseShadow.setScale(0.5);
    corpseShadow.setDepth(4);
    corpseShadow.setAlpha(0.3);

    // Corpse fades out after 15 seconds
    this.time.delayedCall(15000, () => {
      this.tweens.add({
        targets: [corpse, corpseShadow],
        alpha: 0,
        duration: 2000,
        onComplete: () => {
          corpse.destroy();
          corpseShadow.destroy();
        },
      });
    });

    // Immediately hide player and teleport to base
    this.player.setAlpha(0);
    this.player.setVelocity(0, 0);
    this.playerShadow.setAlpha(0);

    // Mark player as dead (enemies should ignore)
    this.player.setData('isDead', true);

    // Show death text at corpse location
    const deathText = this.add.text(deathX, deathY - 40, 'YOU DIED', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#ff0000',
      stroke: '#000000',
      strokeThickness: 3,
    });
    deathText.setOrigin(0.5);
    deathText.setDepth(300);

    // Animate death text
    this.tweens.add({
      targets: deathText,
      y: deathY - 80,
      alpha: 0,
      duration: 2000,
      ease: 'Power2',
      onComplete: () => {
        deathText.destroy();
      },
    });

    // Respawn after short delay
    this.time.delayedCall(1500, () => {
      // Move to spawn point (base)
      this.player.setPosition(this.baseCenter.x, this.baseCenter.y + 30);
      this.updateShadowPosition();

      // Restore health
      const maxHealth = this.player.getData('maxHealth') as number || GAME_CONFIG.PLAYER_BASE_HEALTH;
      this.player.setData('health', maxHealth);
      this.player.setData('isDead', false);

      // Fade in player
      this.tweens.add({
        targets: [this.player, this.playerShadow],
        alpha: 1,
        duration: 500,
        onComplete: () => {
          // Brief invincibility flash
          this.player.setData('isInvincible', true);
          this.tweens.add({
            targets: this.player,
            alpha: 0.5,
            duration: 100,
            yoyo: true,
            repeat: 10,
            onComplete: () => {
              this.player.setAlpha(1);
              this.player.setData('isInvincible', false);
            },
          });
        },
      });

      // Emit health restored
      gameEvents.emit('player:health-changed', {
        current: maxHealth,
        max: maxHealth,
      });
    });
  }

  private showDustEffect(x: number, y: number): void {
    if (this.anims.exists('dust_anim')) {
      const dust = this.add.sprite(x, y, 'effect_dust1');
      dust.setScale(0.6);
      dust.setDepth(52);
      dust.setAlpha(0.8);
      dust.play('dust_anim');
      dust.once('animationcomplete', () => dust.destroy());
    }
  }

  private showFloatingText(x: number, y: number, text: string, color: number): void {
    const floatingText = this.add.text(x, y, text, {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: `#${color.toString(16).padStart(6, '0')}`,
      stroke: '#000000',
      strokeThickness: 2,
    });
    floatingText.setOrigin(0.5);
    floatingText.setDepth(200);

    this.tweens.add({
      targets: floatingText,
      y: y - 30,
      alpha: 0,
      duration: 1000,
      ease: 'Power2',
      onComplete: () => floatingText.destroy(),
    });
  }

  // Soul draining methods
  private checkForCorpseInteraction(): void {
    // If already draining, don't check for new corpses
    if (this.isDrainingSoul) return;

    // Find nearest corpse within interaction range
    let nearestCorpse: Phaser.Physics.Arcade.Sprite | null = null;
    let nearestDistance = 40; // Interaction range

    this.corpses.getChildren().forEach((corpse) => {
      const sprite = corpse as Phaser.Physics.Arcade.Sprite;
      const distance = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        sprite.x,
        sprite.y
      );

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestCorpse = sprite;
      }
    });

    // Auto-start draining if corpse found and player is stationary
    if (nearestCorpse && this.joystickForce < 0.1) {
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      const isStationary = Math.abs(body.velocity.x) < 5 && Math.abs(body.velocity.y) < 5;

      if (isStationary) {
        this.startSoulDrain(nearestCorpse);
      }
    }
  }

  private startSoulDrain(corpse: Phaser.Physics.Arcade.Sprite): void {
    this.isDrainingSoul = true;
    this.isPlayerDraining = true;
    this.currentDrainTarget = corpse;
    this.drainProgress = 0;

    // Play nervous (soul drain) animation
    this.player.play(`spider_nervous_${this.playerDirection}`, true);
    this.playerShadow.play(`spider_nervous_shadow_${this.playerDirection}`, true);

    // Create progress bar
    this.drainProgressBar = this.add.graphics();
    this.drainProgressBar.setDepth(200);

    // Emit drain started event
    gameEvents.emit('soul:drain-started', {
      corpseId: corpse.getData('originalId'),
    });
  }

  private updateSoulDraining(delta: number): void {
    if (!this.isDrainingSoul || !this.currentDrainTarget) return;

    // Check if player is moving - cancel drain if so
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const isMoving = Math.abs(body.velocity.x) > 10 || Math.abs(body.velocity.y) > 10;

    if (isMoving) {
      this.cancelSoulDrain();
      return;
    }

    // Check if corpse still exists
    if (!this.currentDrainTarget.active) {
      this.cancelSoulDrain();
      return;
    }

    // Check if still in range
    const distance = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      this.currentDrainTarget.x,
      this.currentDrainTarget.y
    );

    if (distance > 50) {
      this.cancelSoulDrain();
      return;
    }

    // Update progress
    this.drainProgress += delta;

    // Update visual effects
    this.updateDrainVisuals();

    // Check if drain complete
    if (this.drainProgress >= this.soulDrainTime) {
      this.completeSoulDrain();
    }
  }

  private updateDrainVisuals(): void {
    if (!this.drainProgressBar || !this.currentDrainTarget) return;

    const corpse = this.currentDrainTarget;
    const progress = this.drainProgress / this.soulDrainTime;

    // Clear and redraw progress bar
    this.drainProgressBar.clear();

    // Background bar
    const barWidth = 40;
    const barHeight = 6;
    const x = corpse.x - barWidth / 2;
    const y = corpse.y - 25;

    this.drainProgressBar.fillStyle(0x000000, 0.7);
    this.drainProgressBar.fillRect(x - 1, y - 1, barWidth + 2, barHeight + 2);

    // Progress fill (purple for souls)
    this.drainProgressBar.fillStyle(0x8844ff);
    this.drainProgressBar.fillRect(x, y, barWidth * progress, barHeight);

    // Soul drain visual effect - particle line from corpse to player
    if (Math.random() > 0.7) {
      const line = this.add.graphics();
      line.lineStyle(2, 0x8844ff, 0.5);
      line.lineBetween(
        corpse.x + Phaser.Math.Between(-5, 5),
        corpse.y + Phaser.Math.Between(-5, 5),
        this.player.x,
        this.player.y
      );
      line.setDepth(150);

      this.tweens.add({
        targets: line,
        alpha: 0,
        duration: 200,
        onComplete: () => line.destroy(),
      });
    }

    // Levitate corpse slightly
    const float = Math.sin(this.drainProgress / 200) * 3;
    corpse.y = corpse.getData('originalY') || corpse.y;
    if (!corpse.getData('originalY')) {
      corpse.setData('originalY', corpse.y);
    }
    corpse.y = (corpse.getData('originalY') as number) - Math.abs(float) - progress * 10;
  }

  private completeSoulDrain(): void {
    if (!this.currentDrainTarget) return;

    const corpse = this.currentDrainTarget;
    const soulValue = corpse.getData('soulValue') as number;

    // Emit soul collected event
    gameEvents.emit('soul:collected', { amount: soulValue });

    // Show floating text
    this.showFloatingText(corpse.x, corpse.y - 20, `+${soulValue} Soul`, 0x8844ff);

    // Destroy corpse with effect
    this.tweens.add({
      targets: corpse,
      alpha: 0,
      scale: 0.5,
      duration: 300,
      onComplete: () => {
        corpse.destroy();
      },
    });

    // Cleanup
    this.cleanupSoulDrain();

    // Emit drain complete event
    gameEvents.emit('soul:drain-completed', { amount: soulValue });
  }

  private cancelSoulDrain(): void {
    if (this.currentDrainTarget) {
      // Reset corpse position
      const originalY = this.currentDrainTarget.getData('originalY');
      if (originalY !== undefined) {
        this.currentDrainTarget.y = originalY;
      }
    }

    this.cleanupSoulDrain();

    gameEvents.emit('soul:drain-cancelled', undefined);
  }

  private cleanupSoulDrain(): void {
    this.isDrainingSoul = false;
    this.isPlayerDraining = false;
    this.currentDrainTarget = null;
    this.drainProgress = 0;

    if (this.drainProgressBar) {
      this.drainProgressBar.destroy();
      this.drainProgressBar = null;
    }

    // Return to idle animation
    this.player.play(`spider_idle_${this.playerDirection}`, true);
    this.playerShadow.play(`spider_idle_shadow_${this.playerDirection}`, true);
  }

  // HP Bar methods
  private createHpBar(entityId: string): void {
    const graphics = this.add.graphics();
    graphics.setDepth(100);
    this.hpBarsGraphics.set(entityId, graphics);
  }

  private updateHpBars(): void {
    // Update HP bars for all enemies
    this.enemies.getChildren().forEach((enemy) => {
      const sprite = enemy as Phaser.Physics.Arcade.Sprite;
      const entityId = sprite.getData('id') as string;
      const state = sprite.getData('state') as EnemyState;

      if (state === 'dead') return;

      const graphics = this.hpBarsGraphics.get(entityId);
      if (!graphics) return;

      const current = sprite.getData('health') as number;
      const max = sprite.getData('maxHealth') as number;

      this.drawHpBar(graphics, sprite.x, sprite.y - 20, current, max);
    });

    // Update HP bars for resource deposits
    this.resourceDeposits.getChildren().forEach((deposit) => {
      const sprite = deposit as Phaser.Physics.Arcade.Sprite;
      const entityId = sprite.getData('id') as string;
      const graphics = this.hpBarsGraphics.get(entityId);

      if (!graphics) return;

      const current = sprite.getData('health') as number;
      const max = sprite.getData('maxHealth') as number;

      // Only show HP bar if damaged
      if (current < max) {
        this.drawHpBar(graphics, sprite.x, sprite.y - 35, current, max);
      } else {
        graphics.clear();
      }
    });

    // Update HP bars for units
    this.units.getChildren().forEach((unitObj) => {
      const sprite = unitObj as Phaser.Physics.Arcade.Sprite;
      const entityId = sprite.getData('id') as string;
      const state = sprite.getData('state') as UnitState;

      if (state === 'dead') return;

      const graphics = this.hpBarsGraphics.get(entityId);
      if (!graphics) return;

      const current = sprite.getData('health') as number;
      const max = sprite.getData('maxHealth') as number;

      this.drawHpBar(graphics, sprite.x, sprite.y - 20, current, max);
    });
  }

  private drawHpBar(graphics: Phaser.GameObjects.Graphics, x: number, y: number, current: number, max: number): void {
    const width = 30;
    const height = 4;
    const barX = x - width / 2;
    const barY = y;

    graphics.clear();

    // Background (black)
    graphics.fillStyle(0x000000);
    graphics.fillRect(barX - 1, barY - 1, width + 2, height + 2);

    // HP bar background (dark red)
    graphics.fillStyle(0x4a0000);
    graphics.fillRect(barX, barY, width, height);

    // HP bar fill (green to red gradient based on HP)
    const hpPercent = current / max;
    let color = 0x00ff00; // Green
    if (hpPercent < 0.5) {
      color = 0xffff00; // Yellow
    }
    if (hpPercent < 0.25) {
      color = 0xff0000; // Red
    }

    graphics.fillStyle(color);
    graphics.fillRect(barX, barY, width * hpPercent, height);
  }

  private removeHpBar(entityId: string): void {
    const graphics = this.hpBarsGraphics.get(entityId);
    if (graphics) {
      graphics.destroy();
      this.hpBarsGraphics.delete(entityId);
    }
  }

  // ========== UNIT SYSTEM ==========

  private spawnUnit(unitType: string): void {
    // Check if we can spawn more units
    if (this.armySize >= this.maxArmySize) {
      this.showFloatingText(this.player.x, this.player.y - 30, 'ARMY FULL!', 0xff4444);
      gameEvents.emit('army:full', undefined);
      return;
    }

    // Get unit config
    const config = UNIT_CONFIGS[unitType as keyof typeof UNIT_CONFIGS];
    if (!config) {
      console.error(`Unknown unit type: ${unitType}`);
      return;
    }

    // Spawn position - near player with random offset
    const angle = Math.random() * Math.PI * 2;
    const distance = GAME_CONFIG.UNIT_SPREAD_RADIUS + Math.random() * 20;
    const spawnX = this.player.x + Math.cos(angle) * distance;
    const spawnY = this.player.y + Math.sin(angle) * distance;

    const unitId = `unit_${this.unitIdCounter++}`;

    // Use Tiny Swords sprite if available, otherwise fallback to placeholder
    const spriteKey = config.sprites?.idle || 'unit_placeholder';
    const unit = this.physics.add.sprite(spawnX, spawnY, spriteKey);

    // Create animations for this unit type if sprites are configured
    if (config.sprites) {
      this.createUnitAnimations(unitType, config);
      const idleAnimKey = `${unitType}_idle`;
      if (this.anims.exists(idleAnimKey)) {
        unit.play(idleAnimKey);
      }
    }

    // Apply scale from config
    if (config.scale) {
      unit.setScale(config.scale);
    }

    // Set unit data
    unit.setData('type', 'unit');
    unit.setData('id', unitId);
    unit.setData('unitType', unitType);
    unit.setData('health', config.health);
    unit.setData('maxHealth', config.health);
    unit.setData('damage', config.damage);
    unit.setData('attackSpeed', config.attackSpeed);
    unit.setData('attackRange', config.attackRange);
    unit.setData('moveSpeed', config.moveSpeed);
    unit.setData('attackType', config.attackType);
    unit.setData('specialAbility', 'specialAbility' in config ? config.specialAbility : undefined);
    unit.setData('lastAttackTime', 0);
    unit.setData('state', 'follow' as UnitState);
    unit.setData('currentTarget', null);
    unit.setData('followOffset', { x: Math.cos(angle) * GAME_CONFIG.UNIT_FOLLOW_DISTANCE, y: Math.sin(angle) * GAME_CONFIG.UNIT_FOLLOW_DISTANCE });

    unit.setCollideWorldBounds(true);
    unit.setDepth(8);

    // Set hitbox
    const body = unit.body as Phaser.Physics.Arcade.Body;
    body.setSize(24, 24);
    body.setOffset(4, 4);

    // Create HP bar
    this.createHpBar(unitId);

    // Add to group
    this.units.add(unit);
    this.armySize++;

    // Emit army update
    gameEvents.emit('army:updated', { count: this.armySize, limit: this.maxArmySize });

    // Emit unit produced event for quest tracking
    gameEvents.emit('unit:produced', { unitType, unitId });

    // Show spawn effect
    // Set visual tint based on unit type
    this.setUnitTint(unit, unitType);

    this.showFloatingText(spawnX, spawnY - 20, `+${config.name}`, 0x6a5acd);

    // Spawn animation
    const targetScale = config.scale || 1;
    unit.setAlpha(0);
    unit.setScale(targetScale * 0.5);
    this.tweens.add({
      targets: unit,
      alpha: 1,
      scale: targetScale,
      duration: 300,
      ease: 'Back.easeOut',
    });

    // Save army state after spawning
    this.saveCurrentArmy();
  }

  // Spawn unit from saved data (used when loading game)
  private spawnUnitFromSave(savedUnit: SavedUnit): void {
    const config = UNIT_CONFIGS[savedUnit.unitType as keyof typeof UNIT_CONFIGS];
    if (!config) return;

    // Spawn near player
    const angle = Math.random() * Math.PI * 2;
    const distance = GAME_CONFIG.UNIT_SPREAD_RADIUS + Math.random() * 20;
    const spawnX = this.player.x + Math.cos(angle) * distance;
    const spawnY = this.player.y + Math.sin(angle) * distance;

    const unitId = `unit_${this.unitIdCounter++}`;
    const spriteKey = config.sprites?.idle || 'unit_placeholder';
    const unit = this.physics.add.sprite(spawnX, spawnY, spriteKey);

    if (config.sprites) {
      this.createUnitAnimations(savedUnit.unitType, config);
      const idleAnimKey = `${savedUnit.unitType}_idle`;
      if (this.anims.exists(idleAnimKey)) {
        unit.play(idleAnimKey);
      }
    }

    if (config.scale) {
      unit.setScale(config.scale);
    }

    // Set unit data with saved health values
    unit.setData('type', 'unit');
    unit.setData('id', unitId);
    unit.setData('unitType', savedUnit.unitType);
    unit.setData('health', savedUnit.health);
    unit.setData('maxHealth', savedUnit.maxHealth);
    unit.setData('damage', config.damage);
    unit.setData('attackSpeed', config.attackSpeed);
    unit.setData('attackRange', config.attackRange);
    unit.setData('moveSpeed', config.moveSpeed);
    unit.setData('attackType', config.attackType);
    unit.setData('specialAbility', 'specialAbility' in config ? config.specialAbility : undefined);
    unit.setData('lastAttackTime', 0);
    unit.setData('state', 'follow' as UnitState);
    unit.setData('currentTarget', null);
    unit.setData('followOffset', { x: Math.cos(angle) * GAME_CONFIG.UNIT_FOLLOW_DISTANCE, y: Math.sin(angle) * GAME_CONFIG.UNIT_FOLLOW_DISTANCE });

    unit.setCollideWorldBounds(true);
    unit.setDepth(8);

    const body = unit.body as Phaser.Physics.Arcade.Body;
    body.setSize(24, 24);
    body.setOffset(4, 4);

    this.createHpBar(unitId);
    this.units.add(unit);
    this.armySize++;
    this.setUnitTint(unit, savedUnit.unitType);

    gameEvents.emit('army:updated', { count: this.armySize, limit: this.maxArmySize });
  }

  // Save current army state to localStorage
  private saveCurrentArmy(): void {
    const armyData: SavedUnit[] = [];
    this.units.getChildren().forEach((child) => {
      const unit = child as Phaser.Physics.Arcade.Sprite;
      if (unit.active && unit.getData('state') !== 'dead') {
        armyData.push({
          unitType: unit.getData('unitType'),
          health: unit.getData('health'),
          maxHealth: unit.getData('maxHealth'),
        });
      }
    });
    saveArmyUnits(armyData);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private setUnitTint(unit: Phaser.Physics.Arcade.Sprite, _unitType: string): void {
    // Reset tint (now using real sprites, no tint needed for normal state)
    unit.clearTint();
  }

  private createUnitAnimations(unitType: string, config: typeof UNIT_CONFIGS[keyof typeof UNIT_CONFIGS]): void {
    if (!config.sprites) return;

    // Tiny Swords spritesheets have 6 frames in a row
    // Use slower frameRate for better visual perception
    const IDLE_FRAME_RATE = 4;
    const RUN_FRAME_RATE = 5;
    const ATTACK_FRAME_RATE = 6;

    // Create idle animation
    const idleAnimKey = `${unitType}_idle`;
    if (!this.anims.exists(idleAnimKey) && this.textures.exists(config.sprites.idle)) {
      const texture = this.textures.get(config.sprites.idle);
      const frameCount = texture.frameTotal - 1; // frameTotal includes __BASE, subtract 1
      this.anims.create({
        key: idleAnimKey,
        frames: this.anims.generateFrameNumbers(config.sprites.idle, { start: 0, end: Math.max(0, frameCount - 1) }),
        frameRate: IDLE_FRAME_RATE,
        repeat: -1
      });
    }

    // Create run animation
    const runAnimKey = `${unitType}_run`;
    if (!this.anims.exists(runAnimKey) && this.textures.exists(config.sprites.run)) {
      const texture = this.textures.get(config.sprites.run);
      const frameCount = texture.frameTotal - 1;
      this.anims.create({
        key: runAnimKey,
        frames: this.anims.generateFrameNumbers(config.sprites.run, { start: 0, end: Math.max(0, frameCount - 1) }),
        frameRate: RUN_FRAME_RATE,
        repeat: -1
      });
    }

    // Create attack animation
    const attackAnimKey = `${unitType}_attack`;
    if (!this.anims.exists(attackAnimKey) && this.textures.exists(config.sprites.attack)) {
      const texture = this.textures.get(config.sprites.attack);
      const frameCount = texture.frameTotal - 1;
      this.anims.create({
        key: attackAnimKey,
        frames: this.anims.generateFrameNumbers(config.sprites.attack, { start: 0, end: Math.max(0, frameCount - 1) }),
        frameRate: ATTACK_FRAME_RATE,
        repeat: 0
      });
    }
  }

  // Unit AI: follows player, auto-attacks nearby enemies
  // States: follow (move to player), attack (engage enemy), return (back to player), dead
  private updateUnits(time: number): void {
    this.units.getChildren().forEach((unitObj) => {
      const unit = unitObj as Phaser.Physics.Arcade.Sprite;
      const state = unit.getData('state') as UnitState;

      if (state === 'dead') return;

      const moveSpeed = unit.getData('moveSpeed') as number;
      const attackRange = unit.getData('attackRange') as number;

      // Calculate distance to player
      const distanceToPlayer = Phaser.Math.Distance.Between(
        unit.x,
        unit.y,
        this.player.x,
        this.player.y
      );

      // Find nearest enemy (priority target)
      let nearestEnemy: Phaser.Physics.Arcade.Sprite | null = null;
      let nearestEnemyDistance: number = GAME_CONFIG.UNIT_AGGRO_RADIUS;

      this.enemies.getChildren().forEach((enemyObj) => {
        const enemy = enemyObj as Phaser.Physics.Arcade.Sprite;
        if (enemy.getData('state') === 'dead') return;

        const distance = Phaser.Math.Distance.Between(unit.x, unit.y, enemy.x, enemy.y);
        if (distance < nearestEnemyDistance) {
          nearestEnemyDistance = distance;
          nearestEnemy = enemy;
        }
      });

      // Find nearest structure (secondary target) if no enemies
      let nearestStructure: Phaser.Physics.Arcade.Sprite | null = null;
      let nearestStructureDistance: number = GAME_CONFIG.UNIT_AGGRO_RADIUS;

      if (!nearestEnemy) {
        // Check towers
        this.towers.getChildren().forEach((towerObj) => {
          const tower = towerObj as Phaser.Physics.Arcade.Sprite;
          if (tower.getData('state') === 'destroyed') return;

          const distance = Phaser.Math.Distance.Between(unit.x, unit.y, tower.x, tower.y);
          if (distance < nearestStructureDistance) {
            nearestStructureDistance = distance;
            nearestStructure = tower;
          }
        });

        // Check houses
        this.houses.getChildren().forEach((houseObj) => {
          const house = houseObj as Phaser.Physics.Arcade.Sprite;
          if (house.getData('state') === 'destroyed') return;

          const distance = Phaser.Math.Distance.Between(unit.x, unit.y, house.x, house.y);
          if (distance < nearestStructureDistance) {
            nearestStructureDistance = distance;
            nearestStructure = house;
          }
        });
      }

      // State machine
      switch (state) {
        case 'follow':
          // If too far from player, return
          if (distanceToPlayer > GAME_CONFIG.UNIT_RETURN_DISTANCE) {
            unit.setData('state', 'return' as UnitState);
            break;
          }

          // If enemy in range, attack (priority)
          if (nearestEnemy && nearestEnemyDistance < GAME_CONFIG.UNIT_AGGRO_RADIUS) {
            unit.setData('state', 'attack' as UnitState);
            unit.setData('currentTarget', nearestEnemy);
            break;
          }

          // If structure in range, attack (secondary)
          if (nearestStructure && nearestStructureDistance < GAME_CONFIG.UNIT_AGGRO_RADIUS) {
            unit.setData('state', 'attack' as UnitState);
            unit.setData('currentTarget', nearestStructure);
            break;
          }

          // Follow player at distance
          this.unitFollowPlayer(unit, moveSpeed);
          break;

        case 'attack':
          // Check if we should return to player
          if (distanceToPlayer > GAME_CONFIG.UNIT_RETURN_DISTANCE) {
            unit.setData('state', 'return' as UnitState);
            unit.setData('currentTarget', null);
            break;
          }

          // Check if current target is still valid
          const currentTarget = unit.getData('currentTarget') as Phaser.Physics.Arcade.Sprite | null;
          const targetType = currentTarget?.getData('type') as string | undefined;
          const isValidEnemy = targetType === 'enemy' && currentTarget?.getData('state') !== 'dead';
          const isValidStructure = (targetType === 'tower' || targetType === 'house') && currentTarget?.getData('state') !== 'destroyed';

          if (!currentTarget || !currentTarget.active || (!isValidEnemy && !isValidStructure)) {
            // Find new target or return to follow
            if (nearestEnemy) {
              unit.setData('currentTarget', nearestEnemy);
            } else if (nearestStructure) {
              unit.setData('currentTarget', nearestStructure);
            } else {
              unit.setData('state', 'follow' as UnitState);
              unit.setData('currentTarget', null);
              break;
            }
          }

          // Attack current target
          const target = unit.getData('currentTarget') as Phaser.Physics.Arcade.Sprite;
          if (target && target.active) {
            const distanceToTarget = Phaser.Math.Distance.Between(unit.x, unit.y, target.x, target.y);
            const targetTypeForAttack = target.getData('type') as string;

            if (distanceToTarget <= attackRange) {
              // In range - attack
              unit.setVelocity(0, 0);
              if (targetTypeForAttack === 'enemy') {
                this.unitAttack(unit, target, time);
              } else {
                this.unitAttackStructure(unit, target, time);
              }
            } else {
              // Move toward target
              const angle = Phaser.Math.Angle.Between(unit.x, unit.y, target.x, target.y);
              unit.setVelocity(Math.cos(angle) * moveSpeed, Math.sin(angle) * moveSpeed);
              unit.setFlipX(target.x < unit.x);
            }
          }
          break;

        case 'return':
          // Return to player
          if (distanceToPlayer < GAME_CONFIG.UNIT_FOLLOW_DISTANCE) {
            unit.setData('state', 'follow' as UnitState);
            break;
          }

          // Move toward player
          const angleToPlayer = Phaser.Math.Angle.Between(unit.x, unit.y, this.player.x, this.player.y);
          unit.setVelocity(Math.cos(angleToPlayer) * moveSpeed * 1.5, Math.sin(angleToPlayer) * moveSpeed * 1.5);
          unit.setFlipX(this.player.x < unit.x);
          break;
      }
    });
  }

  // ========== TOWER SYSTEM ==========
  // Enemy defense towers that shoot arrows at player and units

  private updateTowers(time: number): void {
    this.towers.getChildren().forEach((towerObj) => {
      const tower = towerObj as Phaser.Physics.Arcade.Sprite;
      const state = tower.getData('state') as StructureState;

      if (state === 'destroyed') return;

      const attackRange = tower.getData('attackRange') as number;
      const damage = tower.getData('damage') as number;
      const attackSpeed = tower.getData('attackSpeed') as number;
      const lastAttackTime = tower.getData('lastAttackTime') as number;
      const attackCooldown = 1000 / attackSpeed;

      if (time - lastAttackTime < attackCooldown) return;

      // Find nearest target (player or unit)
      let nearestTarget: Phaser.Physics.Arcade.Sprite | null = null;
      let nearestDistance = attackRange;

      // Check player
      const playerDist = Phaser.Math.Distance.Between(tower.x, tower.y, this.player.x, this.player.y);
      if (playerDist < nearestDistance) {
        nearestDistance = playerDist;
        nearestTarget = this.player;
      }

      // Check units
      this.units.getChildren().forEach((unitObj) => {
        const unit = unitObj as Phaser.Physics.Arcade.Sprite;
        if (unit.getData('state') === 'dead') return;

        const unitDist = Phaser.Math.Distance.Between(tower.x, tower.y, unit.x, unit.y);
        if (unitDist < nearestDistance) {
          nearestDistance = unitDist;
          nearestTarget = unit;
        }
      });

      // Attack if target found
      if (nearestTarget) {
        tower.setData('lastAttackTime', time);

        // Fire arrow projectile (like archers, can miss if target moves)
        this.fireArrowProjectile(tower.x, tower.y - 30, nearestTarget, damage);

        // Visual feedback - flash red then return to normal
        tower.setTint(0xff6644);
        this.time.delayedCall(100, () => {
          if (tower.active && tower.getData('state') === 'active') {
            tower.clearTint(); // Return to normal sprite color
          }
        });
      }
    });
  }

  private updateHouses(time: number): void {
    this.houses.getChildren().forEach((houseObj) => {
      const house = houseObj as Phaser.Physics.Arcade.Sprite;
      const state = house.getData('state') as StructureState;

      if (state === 'destroyed') return;

      const spawnsRemaining = house.getData('spawnsRemaining') as number;
      const spawnInterval = house.getData('spawnInterval') as number;
      const lastSpawnTime = house.getData('lastSpawnTime') as number;

      // Check if house can spawn more enemies
      if (spawnsRemaining <= 0) return;
      if (time - lastSpawnTime < spawnInterval) return;

      // Check if player is nearby to trigger spawn
      const distanceToPlayer = Phaser.Math.Distance.Between(house.x, house.y, this.player.x, this.player.y);
      if (distanceToPlayer > 250) return; // Only spawn when player is close

      // Spawn enemy
      const spawnTypes = house.getData('spawnTypes') as EnemyType[];
      const enemyType = spawnTypes[Phaser.Math.Between(0, spawnTypes.length - 1)];
      const houseId = house.getData('id') as string;

      // Spawn near house
      const angle = Math.random() * Math.PI * 2;
      const spawnX = house.x + Math.cos(angle) * 40;
      const spawnY = house.y + Math.sin(angle) * 40;

      const enemyId = `enemy_${this.enemyIdCounter++}`;
      const enemy = this.spawnEnemy(spawnX, spawnY, enemyId, enemyType);
      enemy.setData('houseId', houseId); // Link to house

      // Update house spawn data
      house.setData('spawnsRemaining', spawnsRemaining - 1);
      house.setData('lastSpawnTime', time);

      // Visual feedback - house pulses orange then returns to normal
      house.setTint(0xffaa66);
      this.time.delayedCall(200, () => {
        if (house.active && house.getData('state') === 'active') {
          house.clearTint(); // Return to normal sprite color
        }
      });

      // Show spawn effect
      this.showFloatingText(house.x, house.y - 30, 'Enemy spawned!', 0xffaa66);
    });
  }

  private unitFollowPlayer(unit: Phaser.Physics.Arcade.Sprite, moveSpeed: number): void {
    const followOffset = unit.getData('followOffset') as { x: number; y: number };
    const targetX = this.player.x + followOffset.x;
    const targetY = this.player.y + followOffset.y;

    const distanceToTarget = Phaser.Math.Distance.Between(unit.x, unit.y, targetX, targetY);

    if (distanceToTarget > 10) {
      // Move toward follow position
      const angle = Phaser.Math.Angle.Between(unit.x, unit.y, targetX, targetY);
      const speed = Math.min(moveSpeed, distanceToTarget * 2);
      unit.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
      unit.setFlipX(targetX < unit.x);
    } else {
      // At follow position - stop
      unit.setVelocity(0, 0);
    }
  }

  private unitAttack(unit: Phaser.Physics.Arcade.Sprite, target: Phaser.Physics.Arcade.Sprite, time: number): void {
    const attackSpeed = unit.getData('attackSpeed') as number;
    const lastAttackTime = unit.getData('lastAttackTime') as number;
    const attackCooldown = 1000 / attackSpeed;

    if (time - lastAttackTime < attackCooldown) return;

    const damage = unit.getData('damage') as number;
    const attackType = unit.getData('attackType') as string || 'melee';
    const specialAbility = unit.getData('specialAbility') as string | undefined;
    const unitType = unit.getData('unitType') as string;
    unit.setData('lastAttackTime', time);

    // Stop moving during attack
    unit.setVelocity(0, 0);

    // Play attack animation
    const attackAnimKey = `${unitType}_attack`;
    if (this.anims.exists(attackAnimKey)) {
      unit.play(attackAnimKey, true);
      // Return to idle after attack
      unit.once('animationcomplete', () => {
        if (unit.active) {
          const idleAnimKey = `${unitType}_idle`;
          if (this.anims.exists(idleAnimKey)) {
            unit.play(idleAnimKey, true);
          }
        }
      });
    }

    // Create dust effect on attack
    this.createAttackDustEffect(unit.x, unit.y);

    // Apply special abilities
    if (specialAbility) {
      this.applyUnitSpecialAbility(unit, target, damage, specialAbility, time);
    }

    // Ranged units fire projectiles
    if (attackType === 'ranged') {
      // Chica shoots yellow with AoE, Puppet shoots purple
      const projectileColor = unitType === 'chica' ? 0xffcc00 : 0xaa66ff;

      if (specialAbility === 'aoe') {
        // Chica's AoE projectile
        this.fireAoEProjectile(unit.x, unit.y, target, damage, projectileColor);
      } else if (specialAbility === 'mind_control') {
        // Puppet's mind control projectile
        this.fireMindControlProjectile(unit.x, unit.y, target, projectileColor);
      } else {
        this.fireProjectile(unit.x, unit.y, target, damage, projectileColor, 'unit');
      }
    } else {
      // Melee instant damage
      this.dealDamageToEnemy(target, damage);

      // Bonnie lifesteal - heal unit for portion of damage dealt
      if (specialAbility === 'lifesteal') {
        const healAmount = Math.floor(damage * 0.3); // 30% lifesteal
        const currentHealth = unit.getData('health') as number;
        const maxHealth = unit.getData('maxHealth') as number;
        const newHealth = Math.min(maxHealth, currentHealth + healAmount);
        unit.setData('health', newHealth);

        // Show heal effect
        this.showFloatingText(unit.x, unit.y - 10, `+${healAmount}`, 0x00ff00);

        // Green flash for lifesteal
        unit.setTint(0x00ff00);
        this.time.delayedCall(150, () => {
          if (unit.active) unit.clearTint();
        });
      }

      // Attack line for melee
      this.showDustEffect(target.x, target.y);
    }
  }

  private unitAttackStructure(unit: Phaser.Physics.Arcade.Sprite, structure: Phaser.Physics.Arcade.Sprite, time: number): void {
    const attackSpeed = unit.getData('attackSpeed') as number;
    const lastAttackTime = unit.getData('lastAttackTime') as number;
    const attackCooldown = 1000 / attackSpeed;

    if (time - lastAttackTime < attackCooldown) return;

    const damage = unit.getData('damage') as number;
    unit.setData('lastAttackTime', time);

    // Deal damage to structure
    const currentHealth = structure.getData('health') as number;
    const newHealth = Math.max(0, currentHealth - damage);
    structure.setData('health', newHealth);

    const maxHealth = structure.getData('maxHealth') as number;
    const structureId = structure.getData('id') as string;
    const structureType = structure.getData('type') as string;

    // Emit health changed event for HP bar
    gameEvents.emit('entity:health-changed', {
      entityId: structureId,
      x: structure.x,
      y: structure.y - 40,
      current: newHealth,
      max: maxHealth,
    });

    // Show damage number
    gameEvents.emit('combat:damage', {
      x: structure.x,
      y: structure.y,
      damage: damage,
      isCritical: false,
    });

    // Visual feedback
    unit.setTint(0xffff00);
    this.time.delayedCall(100, () => {
      if (unit.active) unit.clearTint();
    });

    structure.setTint(0xffffff);
    this.time.delayedCall(100, () => {
      if (structure.active && structure.getData('state') === 'active') {
        if (structureType === 'tower') {
          structure.setTint(0x8b4513);
        } else {
          structure.setTint(0x885533);
        }
      }
    });

    // Dust effect on hit
    this.showDustEffect(structure.x, structure.y);

    // Check if structure destroyed
    if (newHealth <= 0) {
      this.destroyStructure(structure);
    }
  }

  private applyUnitSpecialAbility(
    _unit: Phaser.Physics.Arcade.Sprite,
    target: Phaser.Physics.Arcade.Sprite,
    _damage: number,
    ability: string,
    time: number
  ): void {
    switch (ability) {
      case 'stun':
        // Foxy's stun - 20% chance to stun for 1 second
        if (Math.random() < 0.2) {
          const isStunned = target.getData('isStunned') as boolean;
          if (!isStunned) {
            target.setData('isStunned', true);
            target.setData('stunEndTime', time + 1000);
            target.setTint(0x888888); // Gray tint for stunned

            // Show stun effect
            this.showFloatingText(target.x, target.y - 20, 'STUNNED!', 0xffff00);

            // Create stun stars effect
            this.createStunEffect(target);
          }
        }
        break;

      // Lifesteal is handled in the attack itself
      // AoE and mind_control are handled in projectile methods
    }
  }

  private createStunEffect(target: Phaser.Physics.Arcade.Sprite): void {
    // Create spinning stars around stunned target
    const stars: Phaser.GameObjects.Text[] = [];
    for (let i = 0; i < 3; i++) {
      const star = this.add.text(target.x, target.y - 15, '*', {
        fontSize: '12px',
        color: '#ffff00',
      });
      star.setOrigin(0.5);
      star.setDepth(150);
      stars.push(star);
    }

    // Animate stars spinning
    let angle = 0;
    const spinInterval = this.time.addEvent({
      delay: 50,
      callback: () => {
        if (!target.active || !target.getData('isStunned')) {
          stars.forEach(s => s.destroy());
          spinInterval.destroy();
          return;
        }
        angle += 0.2;
        stars.forEach((star, i) => {
          const starAngle = angle + (i * Math.PI * 2 / 3);
          star.x = target.x + Math.cos(starAngle) * 12;
          star.y = target.y - 15 + Math.sin(starAngle) * 6;
        });
      },
      loop: true,
    });

    // Cleanup after stun duration
    this.time.delayedCall(1000, () => {
      stars.forEach(s => s.destroy());
      spinInterval.destroy();
    });
  }

  private fireAoEProjectile(
    startX: number,
    startY: number,
    target: Phaser.Physics.Arcade.Sprite,
    damage: number,
    color: number
  ): void {
    // Create larger projectile for AoE
    const projectile = this.add.circle(startX, startY, 6, color);
    projectile.setDepth(50);

    const distance = Phaser.Math.Distance.Between(startX, startY, target.x, target.y);
    const travelTime = Math.min(500, distance * 1.5);

    const targetX = target.x;
    const targetY = target.y;

    this.tweens.add({
      targets: projectile,
      x: targetX,
      y: targetY,
      duration: travelTime,
      ease: 'Linear',
      onComplete: () => {
        // AoE explosion - damage all enemies in radius
        const aoERadius = 60;
        this.enemies.getChildren().forEach((enemyObj) => {
          const enemy = enemyObj as Phaser.Physics.Arcade.Sprite;
          if (enemy.getData('state') === 'dead') return;

          const dist = Phaser.Math.Distance.Between(projectile.x, projectile.y, enemy.x, enemy.y);
          if (dist <= aoERadius) {
            // Full damage to primary target, reduced to others
            const aoeDamage = enemy === target ? damage : Math.floor(damage * 0.5);
            this.dealDamageToEnemy(enemy, aoeDamage);
          }
        });

        // AoE visual effect
        this.createAoEExplosion(projectile.x, projectile.y, color, aoERadius);
        projectile.destroy();
      },
    });
  }

  private createAoEExplosion(x: number, y: number, color: number, radius: number): void {
    const explosion = this.add.circle(x, y, radius, color, 0.3);
    explosion.setDepth(45);

    const ring = this.add.circle(x, y, radius, color, 0);
    ring.setStrokeStyle(3, color, 0.8);
    ring.setDepth(46);

    this.tweens.add({
      targets: [explosion, ring],
      scaleX: 1.5,
      scaleY: 1.5,
      alpha: 0,
      duration: 300,
      onComplete: () => {
        explosion.destroy();
        ring.destroy();
      },
    });
  }

  private fireMindControlProjectile(
    startX: number,
    startY: number,
    target: Phaser.Physics.Arcade.Sprite,
    color: number
  ): void {
    // Create swirly projectile for mind control
    const projectile = this.add.circle(startX, startY, 5, color);
    projectile.setDepth(50);

    const distance = Phaser.Math.Distance.Between(startX, startY, target.x, target.y);
    const travelTime = Math.min(600, distance * 2);

    this.tweens.add({
      targets: projectile,
      x: target.x,
      y: target.y,
      duration: travelTime,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        // 15% chance to convert enemy to temporary ally
        if (target.active && target.getData('state') !== 'dead') {
          if (Math.random() < 0.15) {
            this.applyMindControl(target);
          } else {
            // If mind control fails, deal small damage
            this.dealDamageToEnemy(target, 5);
          }
        }
        this.createImpactEffect(projectile.x, projectile.y, color);
        projectile.destroy();
      },
    });
  }

  private applyMindControl(enemy: Phaser.Physics.Arcade.Sprite): void {
    // Mark enemy as mind controlled
    enemy.setData('isMindControlled', true);
    enemy.setData('mindControlEndTime', this.time.now + 5000); // 5 seconds

    // Visual indication - purple tint
    enemy.setTint(0xaa66ff);

    // Show effect
    this.showFloatingText(enemy.x, enemy.y - 20, 'CONTROLLED!', 0xaa66ff);

    // Create swirl effect
    this.createMindControlEffect(enemy);
  }

  private createMindControlEffect(target: Phaser.Physics.Arcade.Sprite): void {
    const swirl = this.add.circle(target.x, target.y - 10, 8, 0xaa66ff, 0.5);
    swirl.setDepth(150);

    // Animate swirl
    this.tweens.add({
      targets: swirl,
      scaleX: 0,
      scaleY: 0,
      y: target.y - 30,
      alpha: 0,
      duration: 500,
      ease: 'Power2',
      onComplete: () => swirl.destroy(),
    });
  }

  private dealDamageToUnit(unit: Phaser.Physics.Arcade.Sprite, damage: number): void {
    const currentHealth = unit.getData('health') as number;
    const newHealth = Math.max(0, currentHealth - damage);
    unit.setData('health', newHealth);

    const maxHealth = unit.getData('maxHealth') as number;
    const unitId = unit.getData('id') as string;

    // Emit health changed
    gameEvents.emit('entity:health-changed', {
      entityId: unitId,
      x: unit.x,
      y: unit.y - 20,
      current: newHealth,
      max: maxHealth,
    });

    // Show damage
    gameEvents.emit('combat:damage', {
      x: unit.x,
      y: unit.y,
      damage: damage,
      isCritical: false,
    });

    // Flash unit red
    unit.setTint(0xff0000);
    this.time.delayedCall(100, () => {
      if (unit.active) {
        unit.clearTint();
      }
    });

    // Dust effect on damage
    this.showDustEffect(unit.x, unit.y);

    // Check death
    if (newHealth <= 0) {
      this.killUnit(unit);
    } else {
      // Save army state after unit takes damage (but survives)
      this.saveCurrentArmy();
    }
  }

  private killUnit(unit: Phaser.Physics.Arcade.Sprite): void {
    unit.setData('state', 'dead' as UnitState);
    unit.setVelocity(0, 0);

    const unitId = unit.getData('id') as string;
    const unitType = unit.getData('unitType') as string;

    // Remove HP bar
    this.removeHpBar(unitId);

    // Update army count
    this.armySize--;
    gameEvents.emit('army:updated', { count: this.armySize, limit: this.maxArmySize });

    // Save army state after unit death
    this.saveCurrentArmy();

    // Show death text
    this.showFloatingText(unit.x, unit.y - 10, `${UNIT_CONFIGS[unitType as keyof typeof UNIT_CONFIGS]?.name || 'Unit'} died`, 0xff4444);

    // Death animation
    this.tweens.add({
      targets: unit,
      alpha: 0,
      scale: 0.5,
      angle: 90,
      duration: 500,
      onComplete: () => {
        unit.destroy();
      },
    });

    // Emit unit died event
    gameEvents.emit('unit:died', {
      unitId: unitId,
      unitType: unitType,
      position: { x: unit.x, y: unit.y },
    });
  }

  // Public methods
  public getPlayer(): Phaser.Physics.Arcade.Sprite {
    return this.player;
  }

  public getEnemies(): Phaser.Physics.Arcade.Group {
    return this.enemies;
  }

  public getUnits(): Phaser.Physics.Arcade.Group {
    return this.units;
  }

  public getArmyInfo(): { count: number; max: number } {
    return { count: this.armySize, max: this.maxArmySize };
  }

  public requestSpawnUnit(unitType: string): void {
    this.spawnUnit(unitType);
  }
}
