import Phaser from 'phaser';
import { GAME_CONFIG, UNIT_CONFIGS } from '../config/PhaserConfig';
import { gameEvents } from '../managers/EventManager';
import { getSavedUpgrades, getSavedPlayerStats } from '../../stores/gameStore';

type EnemyState = 'idle' | 'chase' | 'attack' | 'flee' | 'dead';
type UnitState = 'follow' | 'attack' | 'return' | 'dead';

type PlayerDirection = 'down' | 'up' | 'left' | 'right';

export class MainScene extends Phaser.Scene {
  // Player
  private player!: Phaser.Physics.Arcade.Sprite;
  private playerSpeed: number = GAME_CONFIG.PLAYER_BASE_SPEED;
  private playerDamage: number = GAME_CONFIG.PLAYER_BASE_DAMAGE;
  private playerAttackRange: number = GAME_CONFIG.PLAYER_BASE_ATTACK_RANGE;
  private playerAttackSpeed: number = GAME_CONFIG.PLAYER_BASE_ATTACK_SPEED;
  private lastPlayerAttackTime: number = 0;
  private playerDirection: PlayerDirection = 'down';
  private isPlayerAttacking: boolean = false;

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

  // Unit management
  private unitIdCounter: number = 0;
  private armySize: number = 0;
  private maxArmySize: number = GAME_CONFIG.ARMY_MAX_SIZE;

  // Buildings
  private storageBuilding!: Phaser.GameObjects.Sprite;
  private storageZone!: Phaser.GameObjects.Zone;
  private isInStorageRange: boolean = false;
  private workbenchBuilding!: Phaser.GameObjects.Sprite;
  private workbenchZone!: Phaser.GameObjects.Zone;
  private isInWorkbenchRange: boolean = false;

  // Soul draining
  private isDrainingSoul: boolean = false;
  private currentDrainTarget: Phaser.Physics.Arcade.Sprite | null = null;
  private drainProgress: number = 0;
  private drainProgressBar: Phaser.GameObjects.Graphics | null = null;
  private soulDrainTime: number = GAME_CONFIG.PLAYER_BASE_SOUL_DRAIN_TIME * 1000; // ms

  // Map
  private mapWidth: number = 1280;
  private mapHeight: number = 960;

  // Base area (safe zone)
  private baseCenter = { x: 640, y: 480 };
  private baseRadius = 150;

  // Spawn points
  private spawnPoints: { x: number; y: number; maxEnemies: number; currentEnemies: number; respawnTimer: number }[] = [];
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
    // Create spider player animations
    this.createPlayerAnimations();

    // Create simple test map
    this.createTestMap();

    // Create groups
    this.droppedResources = this.physics.add.group();
    this.corpses = this.physics.add.group();
    this.resourceDeposits = this.physics.add.group();
    this.units = this.physics.add.group({
      collideWorldBounds: true,
    });

    // Create base buildings
    this.createBaseBuildings();

    // Create resource deposits
    this.createResourceDeposits();

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
  }

  private createPlayerAnimations(): void {
    const directions: PlayerDirection[] = ['down', 'up', 'left', 'right'];
    const frameRate = 12; // Animation speed

    // Create idle animations for each direction
    directions.forEach((dir) => {
      this.anims.create({
        key: `spider_idle_${dir}`,
        frames: this.anims.generateFrameNumbers(`spider_idle_${dir}`, { start: 0, end: 19 }),
        frameRate: frameRate,
        repeat: -1,
      });
    });

    // Create walk animations for each direction
    directions.forEach((dir) => {
      this.anims.create({
        key: `spider_walk_${dir}`,
        frames: this.anims.generateFrameNumbers(`spider_walk_${dir}`, { start: 0, end: 19 }),
        frameRate: frameRate,
        repeat: -1,
      });
    });

    // Create attack animations for each direction
    directions.forEach((dir) => {
      this.anims.create({
        key: `spider_attack_${dir}`,
        frames: this.anims.generateFrameNumbers(`spider_attack_${dir}`, { start: 0, end: 19 }),
        frameRate: frameRate * 1.5, // Attacks are faster
        repeat: 0, // Don't loop
      });
    });

    // Create death animation
    this.anims.create({
      key: 'spider_death',
      frames: this.anims.generateFrameNumbers('spider_death', { start: 0, end: 19 }),
      frameRate: frameRate,
      repeat: 0,
    });
  }

  private createTestMap(): void {
    // Create a simple tiled background
    const tileSize = GAME_CONFIG.TILE_SIZE;
    const tilesX = Math.ceil(this.mapWidth / tileSize);
    const tilesY = Math.ceil(this.mapHeight / tileSize);

    for (let y = 0; y < tilesY; y++) {
      for (let x = 0; x < tilesX; x++) {
        const tile = this.add.rectangle(
          x * tileSize + tileSize / 2,
          y * tileSize + tileSize / 2,
          tileSize - 1,
          tileSize - 1,
          0x1a1a2e
        );

        // Add some variation
        if (Math.random() > 0.9) {
          tile.setFillStyle(0x252540);
        }
      }
    }

    // Add border walls
    const wallColor = 0x4a4a6a;
    this.add.rectangle(this.mapWidth / 2, tileSize / 2, this.mapWidth, tileSize, wallColor);
    this.add.rectangle(this.mapWidth / 2, this.mapHeight - tileSize / 2, this.mapWidth, tileSize, wallColor);
    this.add.rectangle(tileSize / 2, this.mapHeight / 2, tileSize, this.mapHeight, wallColor);
    this.add.rectangle(this.mapWidth - tileSize / 2, this.mapHeight / 2, tileSize, this.mapHeight, wallColor);

    // Set world bounds
    this.physics.world.setBounds(tileSize, tileSize, this.mapWidth - tileSize * 2, this.mapHeight - tileSize * 2);
  }

  private createBaseBuildings(): void {
    // Draw base zone (circle visual)
    const baseGraphics = this.add.graphics();
    baseGraphics.lineStyle(2, 0x4a9f4a, 0.5);
    baseGraphics.strokeCircle(this.baseCenter.x, this.baseCenter.y, this.baseRadius);
    baseGraphics.fillStyle(0x2a5f2a, 0.2);
    baseGraphics.fillCircle(this.baseCenter.x, this.baseCenter.y, this.baseRadius);
    baseGraphics.setDepth(0);

    // Create Storage building
    this.storageBuilding = this.add.sprite(
      this.baseCenter.x,
      this.baseCenter.y - 40,
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

    // Create Workbench building
    this.workbenchBuilding = this.add.sprite(
      this.baseCenter.x + 80,
      this.baseCenter.y + 30,
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
  }

  private createResourceDeposits(): void {
    // Define deposit locations - spread around the map
    const depositData = [
      // Scrap piles (common)
      { x: 150, y: 300, type: 'scrap', health: 50, resourceAmount: 20 },
      { x: 1100, y: 400, type: 'scrap', health: 50, resourceAmount: 20 },
      { x: 300, y: 800, type: 'scrap', health: 50, resourceAmount: 20 },
      { x: 950, y: 700, type: 'scrap', health: 50, resourceAmount: 20 },
      // Polymer nodes (uncommon)
      { x: 250, y: 150, type: 'polymer', health: 80, resourceAmount: 12 },
      { x: 1050, y: 850, type: 'polymer', health: 80, resourceAmount: 12 },
      // Gem clusters (rare)
      { x: 100, y: 850, type: 'gems', health: 120, resourceAmount: 5 },
    ];

    depositData.forEach((data, index) => {
      const textureName = `${data.type}_deposit_placeholder`;
      const deposit = this.physics.add.sprite(data.x, data.y, textureName);

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

      this.resourceDeposits.add(deposit);

      // Create HP bar for deposit
      const depositId = `deposit_${index}`;
      this.createHpBar(depositId);

      // Add label above the deposit
      const labelColor = this.getResourceColor(data.type);
      const label = this.add.text(data.x, data.y - 35, data.type.toUpperCase(), {
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

  private createPlayer(): void {
    // Create player with spider sprite
    this.player = this.physics.add.sprite(
      this.mapWidth / 2,
      this.mapHeight / 2,
      'spider_idle_down'
    );

    // Scale down the sprite (256x256 is too big, scale to ~64x64)
    this.player.setScale(0.25);

    this.player.setCollideWorldBounds(true);
    this.player.setDepth(10);

    // Set player data
    this.player.setData('type', 'player');
    this.player.setData('health', GAME_CONFIG.PLAYER_BASE_HEALTH);
    this.player.setData('maxHealth', GAME_CONFIG.PLAYER_BASE_HEALTH);

    // Set hitbox (adjusted for scaled sprite)
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setSize(180, 180); // Hitbox in original sprite coordinates
    body.setOffset(38, 38); // Center the hitbox

    // Start idle animation
    this.player.play('spider_idle_down');

    // Listen for attack animation complete
    this.player.on('animationcomplete', (anim: Phaser.Animations.Animation) => {
      if (anim.key.includes('attack')) {
        this.isPlayerAttacking = false;
        // Return to idle after attack
        this.player.play(`spider_idle_${this.playerDirection}`);
      }
    });
  }

  private createTestEnemies(): void {
    this.enemies = this.physics.add.group({
      collideWorldBounds: true,
    });

    // Create spawn points around the map (outside base radius)
    this.spawnPoints = [
      { x: 200, y: 200, maxEnemies: 2, currentEnemies: 0, respawnTimer: 0 },
      { x: 1000, y: 200, maxEnemies: 2, currentEnemies: 0, respawnTimer: 0 },
      { x: 200, y: 750, maxEnemies: 2, currentEnemies: 0, respawnTimer: 0 },
      { x: 1000, y: 750, maxEnemies: 2, currentEnemies: 0, respawnTimer: 0 },
      { x: 350, y: 150, maxEnemies: 1, currentEnemies: 0, respawnTimer: 0 },
      { x: 900, y: 500, maxEnemies: 1, currentEnemies: 0, respawnTimer: 0 },
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

  private spawnEnemyAtPoint(spawnPoint: { x: number; y: number; maxEnemies: number; currentEnemies: number; respawnTimer: number }): void {
    if (spawnPoint.currentEnemies >= spawnPoint.maxEnemies) return;

    // Random offset from spawn point
    const offsetX = Phaser.Math.Between(-30, 30);
    const offsetY = Phaser.Math.Between(-30, 30);

    const enemyId = `enemy_${this.enemyIdCounter++}`;
    const enemy = this.spawnEnemy(
      spawnPoint.x + offsetX,
      spawnPoint.y + offsetY,
      enemyId
    );

    // Store spawn point reference on enemy
    enemy.setData('spawnPointIndex', this.spawnPoints.indexOf(spawnPoint));
    spawnPoint.currentEnemies++;
  }

  private spawnEnemy(x: number, y: number, id: string): Phaser.Physics.Arcade.Sprite {
    const enemy = this.physics.add.sprite(x, y, 'enemy_placeholder');
    enemy.setData('type', 'enemy');
    enemy.setData('id', id);
    enemy.setData('health', 30);
    enemy.setData('maxHealth', 30);
    enemy.setData('damage', 5);
    enemy.setData('attackRange', 40);
    enemy.setData('attackSpeed', 1.0); // attacks per second
    enemy.setData('lastAttackTime', 0);
    enemy.setData('aggroRadius', 150);
    enemy.setData('moveSpeed', 50);
    enemy.setData('state', 'idle' as EnemyState);
    enemy.setData('expReward', 15);
    enemy.setCollideWorldBounds(true);
    enemy.setDepth(5);

    // Set hitbox
    const body = enemy.body as Phaser.Physics.Arcade.Body;
    body.setSize(24, 24);
    body.setOffset(4, 4);

    // Create HP bar graphics for this enemy
    this.createHpBar(id);

    this.enemies.add(enemy);
    return enemy;
  }

  private setupCamera(): void {
    const camera = this.cameras.main;
    camera.startFollow(this.player, true, GAME_CONFIG.CAMERA_LERP, GAME_CONFIG.CAMERA_LERP);
    camera.setZoom(GAME_CONFIG.CAMERA_ZOOM);
    camera.setBounds(0, 0, this.mapWidth, this.mapHeight);
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
      // Show floating text for deposit
      this.showFloatingText(
        this.storageBuilding.x,
        this.storageBuilding.y - 20,
        `+${data.total} deposited`,
        0xdaa520
      );

      // Flash storage building
      this.storageBuilding.setTint(0xffd700);
      this.time.delayedCall(200, () => {
        this.storageBuilding.clearTint();
      });
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

    // Destroy resource
    sprite.destroy();
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
    // Flash effect on player
    this.player.setTint(0x44aaff);
    this.time.delayedCall(100, () => this.player.setTint(0xffffff));
    this.time.delayedCall(200, () => this.player.setTint(0x44aaff));
    this.time.delayedCall(300, () => this.player.setTint(0xffffff));

    // Floating text
    this.showFloatingText(this.player.x, this.player.y - 50, `LEVEL UP! Lv.${newLevel}`, 0x44aaff);

    // Particle burst effect
    const particles = this.add.particles(this.player.x, this.player.y, 'particle_placeholder', {
      speed: { min: 50, max: 150 },
      scale: { start: 0.5, end: 0 },
      lifespan: 800,
      quantity: 20,
      tint: 0x44aaff,
      emitting: false,
    });
    particles.explode(20);
    this.time.delayedCall(1000, () => particles.destroy());

    // Play level up sound (if we had audio)
    // this.sound.play('level_up');
  }

  update(time: number, delta: number): void {
    this.handlePlayerMovement();
    this.handlePlayerAutoAttack(time);
    this.updateEnemies(time);
    this.updateUnits(time);
    this.updateHpBars();
    this.checkStorageRange();
    this.checkWorkbenchRange();
    this.updateSoulDraining(delta);
    this.checkForCorpseInteraction();
    this.checkEnemyRespawn(time, delta);
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

  private handlePlayerMovement(): void {
    // Don't allow movement during attack animation
    if (this.isPlayerAttacking) {
      this.player.setVelocity(0, 0);
      return;
    }

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

    // Determine direction based on velocity (4-directional)
    const isMoving = velocityX !== 0 || velocityY !== 0;

    if (isMoving) {
      // Determine primary direction
      let newDirection: PlayerDirection = this.playerDirection;

      if (Math.abs(velocityX) > Math.abs(velocityY)) {
        // Horizontal movement dominant
        newDirection = velocityX < 0 ? 'left' : 'right';
      } else {
        // Vertical movement dominant
        newDirection = velocityY < 0 ? 'up' : 'down';
      }

      // Update direction and animation
      if (newDirection !== this.playerDirection || !this.player.anims.currentAnim?.key.includes('walk')) {
        this.playerDirection = newDirection;
        this.player.play(`spider_walk_${this.playerDirection}`, true);
      }
    } else {
      // Standing still - play idle animation
      if (!this.player.anims.currentAnim?.key.includes('idle')) {
        this.player.play(`spider_idle_${this.playerDirection}`, true);
      }
    }

    gameEvents.emit('player:position', { x: this.player.x, y: this.player.y });
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

    // If no enemies, check for resource deposits in range
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

    // Determine direction to enemy and set player direction
    const dx = enemy.x - this.player.x;
    const dy = enemy.y - this.player.y;

    if (Math.abs(dx) > Math.abs(dy)) {
      this.playerDirection = dx < 0 ? 'left' : 'right';
    } else {
      this.playerDirection = dy < 0 ? 'up' : 'down';
    }

    // Play attack animation
    this.isPlayerAttacking = true;
    this.player.play(`spider_attack_${this.playerDirection}`, true);

    // Deal damage
    this.dealDamageToEnemy(enemy, damage);

    // Attack line effect
    this.showAttackLine(this.player.x, this.player.y, enemy.x, enemy.y, 0x8b0000);
  }

  private playerAttackDeposit(deposit: Phaser.Physics.Arcade.Sprite): void {
    const damage = this.playerDamage;
    const currentHealth = deposit.getData('health') as number;
    const newHealth = Math.max(0, currentHealth - damage);
    deposit.setData('health', newHealth);

    const maxHealth = deposit.getData('maxHealth') as number;
    const depositId = deposit.getData('id') as string;
    const resourceType = deposit.getData('resourceType') as string;

    // Determine direction to deposit and set player direction
    const dx = deposit.x - this.player.x;
    const dy = deposit.y - this.player.y;

    if (Math.abs(dx) > Math.abs(dy)) {
      this.playerDirection = dx < 0 ? 'left' : 'right';
    } else {
      this.playerDirection = dy < 0 ? 'up' : 'down';
    }

    // Play attack animation
    this.isPlayerAttacking = true;
    this.player.play(`spider_attack_${this.playerDirection}`, true);

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

    // Attack line effect (color based on resource type)
    const lineColor = this.getResourceColor(resourceType);
    this.showAttackLine(this.player.x, this.player.y, deposit.x, deposit.y, lineColor);

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
    const textureName = `${type}_placeholder`;
    const resource = this.physics.add.sprite(x, y, textureName);
    resource.setData('resourceType', type);
    resource.setData('amount', amount);
    resource.setDepth(3);

    // Add slight bounce animation
    this.tweens.add({
      targets: resource,
      y: y - 10,
      duration: 200,
      yoyo: true,
      ease: 'Bounce.easeOut',
    });

    // Resource magnet effect - move toward player if close
    this.time.addEvent({
      delay: 100,
      loop: true,
      callback: () => {
        if (!resource.active) return;

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
    const corpse = this.physics.add.sprite(x, y, 'corpse_placeholder');
    corpse.setData('type', 'corpse');
    corpse.setData('originalId', originalId);
    corpse.setData('soulValue', 1);
    corpse.setDepth(2);
    corpse.setAlpha(0.8);

    // Destroy after lifetime
    this.time.delayedCall(GAME_CONFIG.CORPSE_LIFETIME, () => {
      if (corpse.active) {
        // Fade out
        this.tweens.add({
          targets: corpse,
          alpha: 0,
          duration: 500,
          onComplete: () => corpse.destroy(),
        });
      }
    });

    this.corpses.add(corpse);
  }

  private updateEnemies(time: number): void {
    this.enemies.getChildren().forEach((enemy) => {
      const sprite = enemy as Phaser.Physics.Arcade.Sprite;
      const state = sprite.getData('state') as EnemyState;

      if (state === 'dead') return;

      const aggroRadius = sprite.getData('aggroRadius') as number;
      const attackRange = sprite.getData('attackRange') as number;
      const moveSpeed = sprite.getData('moveSpeed') as number;

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

      // State machine
      switch (state) {
        case 'idle':
          sprite.setVelocity(0, 0);
          if (nearestTarget && nearestDistance < aggroRadius) {
            sprite.setData('state', 'chase' as EnemyState);
          }
          break;

        case 'chase':
          if (!nearestTarget || nearestDistance > aggroRadius * 1.5) {
            sprite.setData('state', 'idle' as EnemyState);
            sprite.setVelocity(0, 0);
          } else if (nearestDistance < attackRange) {
            sprite.setData('state', 'attack' as EnemyState);
            sprite.setVelocity(0, 0);
          } else {
            // Move toward target
            const angle = Phaser.Math.Angle.Between(
              sprite.x,
              sprite.y,
              nearestTarget.x,
              nearestTarget.y
            );
            sprite.setVelocity(Math.cos(angle) * moveSpeed, Math.sin(angle) * moveSpeed);

            // Face target
            sprite.setFlipX(nearestTarget.x < sprite.x);
          }
          break;

        case 'attack':
          sprite.setVelocity(0, 0);
          if (!nearestTarget || nearestDistance > attackRange * 1.2) {
            sprite.setData('state', 'chase' as EnemyState);
          } else {
            this.enemyAttack(sprite, nearestTarget, time);
          }
          break;
      }
    });
  }

  private enemyAttack(enemy: Phaser.Physics.Arcade.Sprite, target: Phaser.Physics.Arcade.Sprite, time: number): void {
    const attackSpeed = enemy.getData('attackSpeed') as number;
    const lastAttackTime = enemy.getData('lastAttackTime') as number;
    const attackCooldown = 1000 / attackSpeed;

    if (time - lastAttackTime < attackCooldown) {
      return;
    }

    const damage = enemy.getData('damage') as number;
    enemy.setData('lastAttackTime', time);

    // Check if target is player or unit
    const targetType = target.getData('type') as string;
    if (targetType === 'player') {
      this.dealDamageToPlayer(damage, enemy);
    } else if (targetType === 'unit') {
      this.dealDamageToUnit(target, damage);
    }

    // Visual feedback
    enemy.setTint(0xffff00);
    this.time.delayedCall(100, () => {
      if (enemy.active) {
        enemy.clearTint();
      }
    });

    // Attack line - point to actual target
    this.showAttackLine(enemy.x, enemy.y, target.x, target.y, 0x556b2f);
  }

  private dealDamageToPlayer(damage: number, _source: Phaser.Physics.Arcade.Sprite): void {
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

    // Check death
    if (newHealth <= 0) {
      this.handlePlayerDeath();
    }
  }

  private handlePlayerDeath(): void {
    gameEvents.emit('player:died', {
      position: { x: this.player.x, y: this.player.y },
    });

    // Disable player movement and make semi-transparent
    this.player.setAlpha(0.3);
    this.player.setVelocity(0, 0);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.enable = false;

    // Show death text
    const deathText = this.add.text(this.player.x, this.player.y - 40, 'YOU DIED', {
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
      y: this.player.y - 80,
      alpha: 0,
      duration: 2000,
      ease: 'Power2',
    });

    // Respawn after delay
    this.time.delayedCall(2500, () => {
      // Fade out player
      this.tweens.add({
        targets: this.player,
        alpha: 0,
        duration: 300,
        onComplete: () => {
          // Move to spawn point
          this.player.setPosition(this.baseCenter.x, this.baseCenter.y + 50);

          // Restore health
          this.player.setData('health', GAME_CONFIG.PLAYER_BASE_HEALTH);

          // Re-enable physics
          body.enable = true;

          // Fade in with invincibility effect
          this.tweens.add({
            targets: this.player,
            alpha: 1,
            duration: 500,
            onComplete: () => {
              // Brief invincibility flash effect
              this.tweens.add({
                targets: this.player,
                alpha: 0.5,
                duration: 100,
                yoyo: true,
                repeat: 5,
                onComplete: () => {
                  this.player.setAlpha(1);
                },
              });
            },
          });

          // Emit health restored
          gameEvents.emit('player:health-changed', {
            current: GAME_CONFIG.PLAYER_BASE_HEALTH,
            max: GAME_CONFIG.PLAYER_BASE_HEALTH,
          });

          // Clean up death text
          deathText.destroy();
        },
      });
    });
  }

  private showAttackLine(x1: number, y1: number, x2: number, y2: number, color: number): void {
    const line = this.add.graphics();
    line.lineStyle(2, color, 0.8);
    line.lineBetween(x1, y1, x2, y2);
    line.setDepth(100);

    this.tweens.add({
      targets: line,
      alpha: 0,
      duration: 150,
      onComplete: () => line.destroy(),
    });
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
    this.currentDrainTarget = corpse;
    this.drainProgress = 0;

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
    this.currentDrainTarget = null;
    this.drainProgress = 0;

    if (this.drainProgressBar) {
      this.drainProgressBar.destroy();
      this.drainProgressBar = null;
    }
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
    const unit = this.physics.add.sprite(spawnX, spawnY, 'unit_placeholder');

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

    // Show spawn effect
    this.showFloatingText(spawnX, spawnY - 20, `+${config.name}`, 0x6a5acd);

    // Spawn animation
    unit.setAlpha(0);
    unit.setScale(0.5);
    this.tweens.add({
      targets: unit,
      alpha: 1,
      scale: 1,
      duration: 300,
      ease: 'Back.easeOut',
    });
  }

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

      // Find nearest enemy
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

      // State machine
      switch (state) {
        case 'follow':
          // If too far from player, return
          if (distanceToPlayer > GAME_CONFIG.UNIT_RETURN_DISTANCE) {
            unit.setData('state', 'return' as UnitState);
            break;
          }

          // If enemy in range, attack
          if (nearestEnemy && nearestEnemyDistance < GAME_CONFIG.UNIT_AGGRO_RADIUS) {
            unit.setData('state', 'attack' as UnitState);
            unit.setData('currentTarget', nearestEnemy);
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
          if (!currentTarget || !currentTarget.active || currentTarget.getData('state') === 'dead') {
            // Find new target or return to follow
            if (nearestEnemy) {
              unit.setData('currentTarget', nearestEnemy);
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

            if (distanceToTarget <= attackRange) {
              // In range - attack
              unit.setVelocity(0, 0);
              this.unitAttack(unit, target, time);
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
    unit.setData('lastAttackTime', time);

    // Deal damage
    this.dealDamageToEnemy(target, damage);

    // Visual feedback - flash unit
    unit.setTint(0xffff00);
    this.time.delayedCall(100, () => {
      if (unit.active) {
        unit.clearTint();
      }
    });

    // Attack line
    const attackType = unit.getData('attackType') as string;
    const lineColor = attackType === 'ranged' ? 0x00bfff : 0x6a5acd;
    this.showAttackLine(unit.x, unit.y, target.x, target.y, lineColor);
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

    // Check death
    if (newHealth <= 0) {
      this.killUnit(unit);
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
