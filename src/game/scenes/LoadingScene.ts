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

    // ========== TINY SWORDS ASSETS ==========
    // Frame config for Tiny Swords sprites (8 directions in one row, 192x192 each)
    const tinySwordsConfig = { frameWidth: 192, frameHeight: 192 };

    // ========== ENEMIES (Red Knights) ==========
    // Pawn - unarmed (runs away, attacks with knife) and with axe (melee)
    this.load.spritesheet('enemy_pawn_idle', 'assets/sprites/enemies/pawn/Pawn_Idle.png', tinySwordsConfig);
    this.load.spritesheet('enemy_pawn_run', 'assets/sprites/enemies/pawn/Pawn_Run.png', tinySwordsConfig);
    this.load.spritesheet('enemy_pawn_knife_attack', 'assets/sprites/enemies/pawn/Pawn_Interact_Knife.png', tinySwordsConfig);
    this.load.spritesheet('enemy_pawn_axe_idle', 'assets/sprites/enemies/pawn/Pawn_Idle Axe.png', tinySwordsConfig);
    this.load.spritesheet('enemy_pawn_axe_run', 'assets/sprites/enemies/pawn/Pawn_Run Axe.png', tinySwordsConfig);
    this.load.spritesheet('enemy_pawn_axe_attack', 'assets/sprites/enemies/pawn/Pawn_Interact Axe.png', tinySwordsConfig);

    // Lancer (melee with spear) - Lancer uses 320x320 frames!
    const lancerConfig = { frameWidth: 320, frameHeight: 320 };
    this.load.spritesheet('enemy_lancer_idle', 'assets/sprites/enemies/lancer/Lancer_Idle.png', lancerConfig);
    this.load.spritesheet('enemy_lancer_run', 'assets/sprites/enemies/lancer/Lancer_Run.png', lancerConfig);
    this.load.spritesheet('enemy_lancer_attack_right', 'assets/sprites/enemies/lancer/Lancer_Right_Attack.png', lancerConfig);
    this.load.spritesheet('enemy_lancer_attack_down', 'assets/sprites/enemies/lancer/Lancer_Down_Attack.png', lancerConfig);
    this.load.spritesheet('enemy_lancer_attack_up', 'assets/sprites/enemies/lancer/Lancer_Up_Attack.png', lancerConfig);

    // Archer (ranged)
    this.load.spritesheet('enemy_archer_idle', 'assets/sprites/enemies/archer/Archer_Idle.png', tinySwordsConfig);
    this.load.spritesheet('enemy_archer_run', 'assets/sprites/enemies/archer/Archer_Run.png', tinySwordsConfig);
    this.load.spritesheet('enemy_archer_shoot', 'assets/sprites/enemies/archer/Archer_Shoot.png', tinySwordsConfig);
    // Arrow spritesheet: 64x128 = 2 frames of 64x64 each (arrow points right)
    this.load.spritesheet('enemy_archer_arrow', 'assets/sprites/enemies/archer/Arrow.png', { frameWidth: 64, frameHeight: 64 });

    // Warrior (heavy melee tank)
    this.load.spritesheet('enemy_warrior_idle', 'assets/sprites/enemies/warrior/Warrior_Idle.png', tinySwordsConfig);
    this.load.spritesheet('enemy_warrior_run', 'assets/sprites/enemies/warrior/Warrior_Run.png', tinySwordsConfig);
    this.load.spritesheet('enemy_warrior_attack1', 'assets/sprites/enemies/warrior/Warrior_Attack1.png', tinySwordsConfig);
    this.load.spritesheet('enemy_warrior_attack2', 'assets/sprites/enemies/warrior/Warrior_Attack2.png', tinySwordsConfig);

    // Monk (ranged caster)
    this.load.spritesheet('enemy_monk_idle', 'assets/sprites/enemies/monk/Idle.png', tinySwordsConfig);
    this.load.spritesheet('enemy_monk_run', 'assets/sprites/enemies/monk/Run.png', tinySwordsConfig);
    this.load.spritesheet('enemy_monk_heal', 'assets/sprites/enemies/monk/Heal.png', tinySwordsConfig);
    this.load.spritesheet('enemy_monk_heal_effect', 'assets/sprites/enemies/monk/Heal_Effect.png', tinySwordsConfig);

    // Bosses - Minotaur (320x320), Troll (384x384)
    this.load.spritesheet('boss_minotaur_idle', 'assets/sprites/enemies/minotaur/Minotaur_Idle.png', { frameWidth: 320, frameHeight: 320 });
    this.load.spritesheet('boss_minotaur_walk', 'assets/sprites/enemies/minotaur/Minotaur_Walk.png', { frameWidth: 320, frameHeight: 320 });
    this.load.spritesheet('boss_minotaur_attack', 'assets/sprites/enemies/minotaur/Minotaur_Attack.png', { frameWidth: 320, frameHeight: 320 });
    this.load.spritesheet('boss_troll_idle', 'assets/sprites/enemies/troll/Troll_Idle.png', { frameWidth: 384, frameHeight: 384 });
    this.load.spritesheet('boss_troll_walk', 'assets/sprites/enemies/troll/Troll_Walk.png', { frameWidth: 384, frameHeight: 384 });
    this.load.spritesheet('boss_troll_attack', 'assets/sprites/enemies/troll/Troll_Attack.png', { frameWidth: 384, frameHeight: 384 });

    // ========== PLAYER UNITS (from Enemy Pack) ==========
    // Most units are 192x192 per frame, Bear is 256x256
    const unit192Config = { frameWidth: 192, frameHeight: 192 };
    const unit256Config = { frameWidth: 256, frameHeight: 256 };

    // Gnome (basic melee unit) - 192x192
    this.load.spritesheet('unit_gnome_idle', 'assets/sprites/units/gnome/Gnome_Idle.png', unit192Config);
    this.load.spritesheet('unit_gnome_run', 'assets/sprites/units/gnome/Gnome_Run.png', unit192Config);
    this.load.spritesheet('unit_gnome_attack', 'assets/sprites/units/gnome/Gnome_Attack.png', unit192Config);

    // Bear (tank with lifesteal) - 256x256
    this.load.spritesheet('unit_bear_idle', 'assets/sprites/units/bear/Bear_Idle.png', unit256Config);
    this.load.spritesheet('unit_bear_run', 'assets/sprites/units/bear/Bear_Run.png', unit256Config);
    this.load.spritesheet('unit_bear_attack', 'assets/sprites/units/bear/Bear_Attack.png', unit256Config);

    // Gnoll (DPS with stun) - 192x192
    this.load.spritesheet('unit_gnoll_idle', 'assets/sprites/units/gnoll/Gnoll_Idle.png', unit192Config);
    this.load.spritesheet('unit_gnoll_walk', 'assets/sprites/units/gnoll/Gnoll_Walk.png', unit192Config);
    this.load.spritesheet('unit_gnoll_hit', 'assets/sprites/units/gnoll/Gnoll_Hit.png', unit192Config);
    this.load.spritesheet('unit_gnoll_throw', 'assets/sprites/units/gnoll/Gnoll_Throw.png', unit192Config);

    // Shaman (ranged AoE) - 192x192
    this.load.spritesheet('unit_shaman_idle', 'assets/sprites/units/shaman/Shaman_Idle.png', unit192Config);
    this.load.spritesheet('unit_shaman_run', 'assets/sprites/units/shaman/Shaman_Run.png', unit192Config);
    this.load.spritesheet('unit_shaman_attack', 'assets/sprites/units/shaman/Shaman_Attack.png', unit192Config);
    this.load.spritesheet('unit_shaman_projectile', 'assets/sprites/units/shaman/Shaman_Projectile.png', { frameWidth: 128, frameHeight: 128 });

    // Lizard (support with capture) - 192x192
    this.load.spritesheet('unit_lizard_idle', 'assets/sprites/units/lizard/Lizard_Idle.png', unit192Config);
    this.load.spritesheet('unit_lizard_run', 'assets/sprites/units/lizard/Lizard_Run.png', unit192Config);
    this.load.spritesheet('unit_lizard_attack', 'assets/sprites/units/lizard/Lizard_Attack.png', unit192Config);

    // Skull (for soul pickups) - 192x192
    this.load.spritesheet('skull_idle', 'assets/sprites/units/skull/Skull_Idle.png', unit192Config);
    this.load.spritesheet('skull_run', 'assets/sprites/units/skull/Skull_Run.png', unit192Config);

    // Dead knight corpse sprite - 128x128 frames (896x256 = 7x2 grid)
    this.load.spritesheet('enemy_dead', 'assets/sprites/enemies/Dead.png', { frameWidth: 128, frameHeight: 128 });

    // ========== RESOURCES ==========
    // Dropped resources (pickups): Scrap → Meat, Polymer → Wood, Gems → Gold
    this.load.image('resource_meat', 'assets/sprites/resources/M_Idle.png');
    this.load.image('resource_wood', 'assets/sprites/resources/W_Idle.png');
    this.load.image('resource_gold', 'assets/sprites/resources/G_Idle.png');
    this.load.spritesheet('resource_meat_spawn', 'assets/sprites/resources/M_Spawn.png', { frameWidth: 128, frameHeight: 128 });
    this.load.spritesheet('resource_wood_spawn', 'assets/sprites/resources/W_Spawn.png', { frameWidth: 128, frameHeight: 128 });
    this.load.spritesheet('resource_gold_spawn', 'assets/sprites/resources/G_Spawn.png', { frameWidth: 128, frameHeight: 128 });

    // Resource sources (deposits on map): Sheep for meat, Trees for wood, Gold Mine for gold
    this.load.spritesheet('deposit_sheep', 'assets/sprites/resources/Sheep_Idle.png', { frameWidth: 128, frameHeight: 128 });
    this.load.image('deposit_goldmine', 'assets/sprites/resources/GoldMine_Active.png');
    // Wood deposits use tree sprites from decorations

    // ========== EFFECTS ==========
    // Explosions: 192x192, Dust/Fire: 64x64, Water Splash: 192x192
    this.load.spritesheet('effect_explosion1', 'assets/sprites/effects/Explosion_01.png', { frameWidth: 192, frameHeight: 192 });
    this.load.spritesheet('effect_explosion2', 'assets/sprites/effects/Explosion_02.png', { frameWidth: 192, frameHeight: 192 });
    this.load.spritesheet('effect_dust1', 'assets/sprites/effects/Dust_01.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('effect_dust2', 'assets/sprites/effects/Dust_02.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('effect_fire1', 'assets/sprites/effects/Fire_01.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('effect_fire2', 'assets/sprites/effects/Fire_02.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('effect_fire3', 'assets/sprites/effects/Fire_03.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('effect_water_splash', 'assets/sprites/effects/Water Splash.png', { frameWidth: 192, frameHeight: 192 });

    // ========== BUILDINGS ==========
    this.load.image('building_red_castle', 'assets/sprites/buildings/red/Castle.png');
    this.load.image('building_red_house1', 'assets/sprites/buildings/red/House1.png');
    this.load.image('building_red_house2', 'assets/sprites/buildings/red/House2.png');
    this.load.image('building_red_house3', 'assets/sprites/buildings/red/House3.png');
    this.load.image('building_red_tower', 'assets/sprites/buildings/red/Tower.png');
    this.load.image('building_red_barracks', 'assets/sprites/buildings/red/Barracks.png');
    // Destroyed building states
    this.load.image('building_red_castle_destroyed', 'assets/sprites/buildings/red/destroyed/Castle_Destroyed.png');
    this.load.image('building_red_house_destroyed', 'assets/sprites/buildings/red/destroyed/House_Destroyed.png');
    this.load.image('building_red_tower_destroyed', 'assets/sprites/buildings/red/destroyed/Tower_Destroyed.png');

    // ========== TERRAIN ==========
    // Tilemaps are 576x384 atlases with 64x64 tiles (9 columns x 6 rows)
    // Zone 1: color3 (green forest), Zone 2: color1 (yellow steppe)
    this.load.spritesheet('tilemap_zone1', 'assets/sprites/terrain/Tilemap_color3.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('tilemap_zone2', 'assets/sprites/terrain/Tilemap_color1.png', { frameWidth: 64, frameHeight: 64 });
    this.load.image('water_background', 'assets/sprites/terrain/Water_Background.png');
    // Water Foam: 3072x192 = 16 frames of 192x192 each
    this.load.spritesheet('water_foam', 'assets/sprites/terrain/Water_Foam.png', { frameWidth: 192, frameHeight: 192 });

    // ========== DECORATIONS ==========
    // Bushes (1-2 for Zone 1, 3-4 for Zone 2)
    this.load.image('decor_bush1', 'assets/sprites/decorations/Bushe1.png');
    this.load.image('decor_bush2', 'assets/sprites/decorations/Bushe2.png');
    this.load.image('decor_bush3', 'assets/sprites/decorations/Bushe3.png');
    this.load.image('decor_bush4', 'assets/sprites/decorations/Bushe4.png');

    // Rocks (all zones)
    this.load.image('decor_rock1', 'assets/sprites/decorations/Rock1.png');
    this.load.image('decor_rock2', 'assets/sprites/decorations/Rock2.png');
    this.load.image('decor_rock3', 'assets/sprites/decorations/Rock3.png');
    this.load.image('decor_rock4', 'assets/sprites/decorations/Rock4.png');

    // Trees (1-2 for Zone 1, 3-4 for Zone 2)
    this.load.image('decor_tree1', 'assets/sprites/decorations/Tree1.png');
    this.load.image('decor_tree2', 'assets/sprites/decorations/Tree2.png');
    this.load.image('decor_tree3', 'assets/sprites/decorations/Tree3.png');
    this.load.image('decor_tree4', 'assets/sprites/decorations/Tree4.png');

    // Stumps (all zones)
    this.load.image('decor_stump1', 'assets/sprites/decorations/Stump1.png');
    this.load.image('decor_stump2', 'assets/sprites/decorations/Stump2.png');

    // Clouds (floating decoration) - 8 types
    this.load.image('decor_cloud1', 'assets/sprites/decorations/Cloud1.png');
    this.load.image('decor_cloud2', 'assets/sprites/decorations/Cloud2.png');
    this.load.image('decor_cloud3', 'assets/sprites/decorations/Cloud3.png');
    this.load.image('decor_cloud4', 'assets/sprites/decorations/Cloud4.png');
    this.load.image('decor_cloud5', 'assets/sprites/decorations/Cloud5.png');
    this.load.image('decor_cloud6', 'assets/sprites/decorations/Cloud6.png');
    this.load.image('decor_cloud7', 'assets/sprites/decorations/Cloud7.png');
    this.load.image('decor_cloud8', 'assets/sprites/decorations/Cloud8.png');

    // Water rocks - 4 types
    this.load.image('water_rock1', 'assets/sprites/decorations/WaterRock1.png');
    this.load.image('water_rock2', 'assets/sprites/decorations/WaterRock2.png');
    this.load.image('water_rock3', 'assets/sprites/decorations/WaterRock3.png');
    this.load.image('water_rock4', 'assets/sprites/decorations/WaterRock4.png');

    // ========== RESOURCE HIGHLIGHT (for idle animation) ==========
    this.load.spritesheet('resource_gold_highlight', 'assets/sprites/resources/Gold_Resource_Highlight.png', { frameWidth: 64, frameHeight: 64 });

    // ========== SPIDER PLAYER SPRITESHEETS ==========
    // Each spritesheet is 1024x1280 with 4x5 grid = 20 frames, each frame 256x256
    const frameConfig = { frameWidth: 256, frameHeight: 256 };
    const directions = ['down', 'down_right', 'right', 'up_right', 'up', 'up_left', 'left', 'down_left'];

    // Load all animations for 8 directions (body + shadow)
    for (const dir of directions) {
      // Idle
      this.load.spritesheet(`spider_idle_${dir}`, `assets/sprites/spider/idle_${dir}.png`, frameConfig);
      this.load.spritesheet(`spider_idle_shadow_${dir}`, `assets/sprites/spider/idle_shadow_${dir}.png`, frameConfig);
      // Walk
      this.load.spritesheet(`spider_walk_${dir}`, `assets/sprites/spider/walk_${dir}.png`, frameConfig);
      this.load.spritesheet(`spider_walk_shadow_${dir}`, `assets/sprites/spider/walk_shadow_${dir}.png`, frameConfig);
      // Attack
      this.load.spritesheet(`spider_attack_${dir}`, `assets/sprites/spider/attack_${dir}.png`, frameConfig);
      this.load.spritesheet(`spider_attack_shadow_${dir}`, `assets/sprites/spider/attack_shadow_${dir}.png`, frameConfig);
      // Nervous (for soul drain)
      this.load.spritesheet(`spider_nervous_${dir}`, `assets/sprites/spider/nervous_${dir}.png`, frameConfig);
      this.load.spritesheet(`spider_nervous_shadow_${dir}`, `assets/sprites/spider/nervous_shadow_${dir}.png`, frameConfig);
    }

    // Death animation (single direction)
    this.load.spritesheet('spider_death', 'assets/sprites/spider/death.png', frameConfig);
    this.load.spritesheet('spider_death_shadow', 'assets/sprites/spider/death_shadow.png', frameConfig);

    // ========== TILEMAPS ==========
    // Will be loaded when actual maps are created

    // ========== UI ==========
    // Unit avatars for Workbench menu (from Enemy Pack)
    // 01-05: Gnome (Creepy Clown), 06: Bear (Bonnie), 07-08: Gnoll (Foxy),
    // 09-10: Shaman (Chica), 11-12: Lizard (Puppet), 13-16: Skull
    this.load.image('avatar_gnome', 'assets/sprites/ui/avatars/Enemy Avatars_01.png');
    this.load.image('avatar_bear', 'assets/sprites/ui/avatars/Enemy Avatars_06.png');
    this.load.image('avatar_gnoll', 'assets/sprites/ui/avatars/Enemy Avatars_07.png');
    this.load.image('avatar_shaman', 'assets/sprites/ui/avatars/Enemy Avatars_09.png');
    this.load.image('avatar_lizard', 'assets/sprites/ui/avatars/Enemy Avatars_11.png');
    this.load.image('avatar_skull', 'assets/sprites/ui/avatars/Enemy Avatars_13.png');

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
