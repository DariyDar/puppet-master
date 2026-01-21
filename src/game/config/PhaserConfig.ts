/**
 * Phaser Configuration - Game settings and entity configs
 *
 * Contains:
 * - Phaser engine configuration (rendering, physics, scaling)
 * - GAME_CONFIG: Core gameplay constants (player stats, ranges, speeds)
 * - UNIT_CONFIGS: Player army unit definitions (Gnome, Bear, Gnoll, Shaman, Lizard)
 * - ENEMY_CONFIGS: Enemy types (Pawn variants, Lancer, Archer, Warrior, Monk)
 * - TOWER_CONFIGS: Defense structure settings
 * - HOUSE_CONFIGS: Enemy building settings
 * - FARM_CONFIGS: Resource generator settings
 */

import Phaser from 'phaser';
import { BootScene } from '../scenes/BootScene';
import { LoadingScene } from '../scenes/LoadingScene';
import { MainScene } from '../scenes/MainScene';
import { UIScene } from '../scenes/UIScene';
import { ArtGalleryScene } from '../scenes/ArtGalleryScene';

// Get the base path for assets (works with GitHub Pages)
export const getAssetPath = (path: string): string => {
  const base = import.meta.env.BASE_URL || '/';
  return `${base}${path}`.replace('//', '/');
};

export const createPhaserConfig = (
  parent: string | HTMLElement
): Phaser.Types.Core.GameConfig => {
  return {
    type: Phaser.AUTO,
    parent,
    width: window.innerWidth,
    height: window.innerHeight,
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    backgroundColor: '#1a1a2e',
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false, // Disabled for cleaner visuals
      },
    },
    scene: [BootScene, LoadingScene, MainScene, UIScene, ArtGalleryScene],
    input: {
      activePointers: 3, // Support multi-touch
    },
    render: {
      pixelArt: true,
      antialias: false,
    },
  };
};

// Export default config for direct use
export const phaserConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  backgroundColor: '#1a1a2e',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false, // Disabled for cleaner visuals
    },
  },
  scene: [BootScene, LoadingScene, MainScene, UIScene, ArtGalleryScene],
  input: {
    activePointers: 3,
  },
  render: {
    pixelArt: true,
    antialias: false,
  },
};

// Game constants
export const GAME_CONFIG = {
  // Tile size
  TILE_SIZE: 32,

  // Camera
  CAMERA_ZOOM: 2,
  CAMERA_LERP: 0.1,

  // Player
  PLAYER_BASE_SPEED: 100,
  PLAYER_BASE_HEALTH: 150,
  PLAYER_BASE_DAMAGE: 10,
  PLAYER_BASE_ATTACK_SPEED: 1.0,
  PLAYER_BASE_ATTACK_RANGE: 50,
  PLAYER_BASE_CARGO: 50,
  PLAYER_BASE_SOUL_DRAIN_TIME: 3,

  // Combat
  AUTO_ATTACK_CHECK_INTERVAL: 100, // ms

  // Resources
  RESOURCE_MAGNET_RADIUS: 50,
  RESOURCE_LIFETIME: 60000, // ms
  DROPPED_RESOURCE_SPEED: 200,

  // Buildings
  STORAGE_COLLECT_RADIUS: 100,
  WORKBENCH_INTERACT_RADIUS: 80,
  FARM_INTERACT_RADIUS: 80,

  // Souls
  CORPSE_LIFETIME: 30000, // ms

  // Spawning
  SPAWN_CHECK_INTERVAL: 1000, // ms

  // Save
  AUTO_SAVE_INTERVAL: 30000, // ms

  // Offline
  MAX_OFFLINE_HOURS: 8,

  // Units
  UNIT_FOLLOW_DISTANCE: 80, // Distance to maintain from player
  UNIT_AGGRO_RADIUS: 150, // Range to detect and attack enemies
  UNIT_RETURN_DISTANCE: 300, // If further from player, return
  UNIT_SPREAD_RADIUS: 40, // Spread around player when following
  ARMY_MAX_SIZE: 5, // Default max army size
} as const;

// Animation frame rate for attack animations (used for attackSpeed calculation)
export const ATTACK_FRAME_RATE = 8;

// Unit type configurations
// Sprites from Tiny Swords Enemy Pack
// attackSpeed = ATTACK_FRAME_RATE / attackFrameCount (so animation duration = attack cooldown)
export const UNIT_CONFIGS = {
  creepy_clown: {
    id: 'creepy_clown',
    name: 'Gnome',
    health: 80,
    damage: 15,
    attackSpeed: 8 / 7, // 7 frames @ 8fps = 0.875s per attack = 1.14 attacks/sec
    attackFrameCount: 7,
    attackRange: 45,
    moveSpeed: 85,
    attackType: 'melee' as const,
    cost: { souls: 1, scrap: 50, polymer: 20 },
    productionTime: 30,
    unlockLevel: 1,
    sprites: {
      idle: 'unit_gnome_idle',
      run: 'unit_gnome_run',
      attack: 'unit_gnome_attack',
    },
    frameSize: 192,
    scale: 0.5,
  },
  bonnie: {
    id: 'bonnie',
    name: 'Bear',
    health: 180,
    damage: 12,
    attackSpeed: 8 / 12, // 12 frames @ 8fps = 1.5s per attack = 0.67 attacks/sec
    attackFrameCount: 12,
    attackRange: 50,
    moveSpeed: 60,
    attackType: 'melee' as const,
    specialAbility: 'lifesteal',
    cost: { souls: 2, scrap: 100, polymer: 50 },
    productionTime: 60,
    unlockLevel: 3,
    sprites: {
      idle: 'unit_bear_idle',
      run: 'unit_bear_run',
      attack: 'unit_bear_attack',
    },
    frameSize: 256,
    scale: 0.4,
  },
  foxy: {
    id: 'foxy',
    name: 'Gnoll',
    health: 60,
    damage: 30,
    attackSpeed: 8 / 2, // 2 frames @ 8fps = 0.25s per attack = 4 attacks/sec (very fast!)
    attackFrameCount: 2,
    attackRange: 40,
    moveSpeed: 120,
    attackType: 'melee' as const,
    specialAbility: 'stun',
    cost: { souls: 2, scrap: 80, polymer: 80 },
    productionTime: 45,
    unlockLevel: 5,
    sprites: {
      idle: 'unit_gnoll_idle',
      run: 'unit_gnoll_walk',
      attack: 'unit_gnoll_hit',
    },
    frameSize: 192,
    scale: 0.5,
  },
  chica: {
    id: 'chica',
    name: 'Shaman',
    health: 70,
    damage: 20,
    attackSpeed: 8 / 10, // 10 frames @ 8fps = 1.25s per attack = 0.8 attacks/sec
    attackFrameCount: 10,
    attackRange: 180,
    moveSpeed: 70,
    attackType: 'ranged' as const,
    specialAbility: 'aoe',
    cost: { souls: 3, scrap: 120, polymer: 100 },
    productionTime: 75,
    unlockLevel: 7,
    sprites: {
      idle: 'unit_shaman_idle',
      run: 'unit_shaman_run',
      attack: 'unit_shaman_attack',
    },
    frameSize: 192,
    scale: 0.5,
  },
  puppet: {
    id: 'puppet',
    name: 'Lizard',
    health: 50,
    damage: 8,
    attackSpeed: 8 / 9, // 9 frames @ 8fps = 1.125s per attack = 0.89 attacks/sec
    attackFrameCount: 9,
    attackRange: 120,
    moveSpeed: 100,
    attackType: 'ranged' as const,
    specialAbility: 'mind_control',
    cost: { souls: 4, scrap: 150, polymer: 150 },
    productionTime: 90,
    unlockLevel: 10,
    sprites: {
      idle: 'unit_lizard_idle',
      run: 'unit_lizard_run',
      attack: 'unit_lizard_attack',
    },
    frameSize: 192,
    scale: 0.5,
  },
} as const;

// Enemy type configurations (damage heavily reduced for early game survivability)
// Sprites from Tiny Swords Asset Pack
// attackSpeed = ATTACK_FRAME_RATE / attackFrameCount (so animation duration = attack cooldown)
export const ENEMY_CONFIGS = {
  peasant_unarmed: {
    id: 'peasant_unarmed',
    name: 'Peasant',
    health: 30,
    damage: 2, // very weak, tutorial enemy
    attackSpeed: 8 / 4, // 4 frames @ 8fps = 0.5s per attack = 2 attacks/sec
    attackFrameCount: 4,
    attackRange: 40,
    moveSpeed: 65, // slower than player (100) even when fleeing (65*1.2=78)
    aggroRadius: 150,
    behavior: 'coward' as const,
    expReward: 10,
    soulValue: 1,
    loot: {
      scrap: { min: 5, max: 10, chance: 1.0 },
      polymer: { min: 1, max: 3, chance: 0.2 },
      gems: { min: 0, max: 0, chance: 0 },
    },
    sprites: {
      idle: 'enemy_pawn_idle',
      run: 'enemy_pawn_run',
      attack: 'enemy_pawn_knife_attack', // attacks with knife, returns to unarmed after
    },
    frameSize: 192,
    scale: 0.5,
  },
  peasant_club: {
    id: 'peasant_club',
    name: 'Peasant (Axe)',
    health: 50,
    damage: 4, // early game enemy
    attackSpeed: 8 / 6, // 6 frames @ 8fps = 0.75s per attack = 1.33 attacks/sec
    attackFrameCount: 6,
    attackRange: 45,
    moveSpeed: 70,
    aggroRadius: 180,
    behavior: 'aggressive' as const,
    expReward: 20,
    soulValue: 1,
    loot: {
      scrap: { min: 8, max: 15, chance: 1.0 },
      polymer: { min: 2, max: 5, chance: 0.3 },
      gems: { min: 0, max: 0, chance: 0 },
    },
    sprites: {
      idle: 'enemy_pawn_axe_idle',
      run: 'enemy_pawn_axe_run',
      attack: 'enemy_pawn_axe_attack',
    },
    frameSize: 192,
    scale: 0.5,
  },
  guard_spear: {
    id: 'guard_spear',
    name: 'Lancer',
    health: 80,
    damage: 6, // moderate threat
    attackSpeed: 8 / 3, // 3 frames @ 8fps = 0.375s per attack = 2.67 attacks/sec (fast poke)
    attackFrameCount: 3,
    attackRange: 70,
    moveSpeed: 65,
    aggroRadius: 200,
    behavior: 'defensive' as const,
    expReward: 35,
    soulValue: 1,
    loot: {
      scrap: { min: 12, max: 20, chance: 1.0 },
      polymer: { min: 5, max: 10, chance: 0.5 },
      gems: { min: 1, max: 1, chance: 0.05 },
    },
    sprites: {
      idle: 'enemy_lancer_idle',
      run: 'enemy_lancer_run',
      attack: 'enemy_lancer_attack_right',
    },
    frameSize: 320, // Lancer uses 320x320 frames!
    scale: 0.45, // Adjusted to match visual size of other enemies
  },
  rogue_crossbow: {
    id: 'rogue_crossbow',
    name: 'Archer',
    health: 40,
    damage: 8, // ranged but fragile
    attackSpeed: 8 / 8, // 8 frames @ 8fps = 1s per attack = 1 attack/sec
    attackFrameCount: 8,
    attackRange: 200,
    moveSpeed: 90,
    aggroRadius: 250,
    behavior: 'aggressive' as const,
    attackType: 'ranged' as const,
    expReward: 40,
    soulValue: 1,
    loot: {
      scrap: { min: 10, max: 18, chance: 1.0 },
      polymer: { min: 8, max: 15, chance: 0.6 },
      gems: { min: 1, max: 1, chance: 0.1 },
    },
    sprites: {
      idle: 'enemy_archer_idle',
      run: 'enemy_archer_run',
      attack: 'enemy_archer_shoot',
    },
    frameSize: 192,
    scale: 0.5,
  },
  knight_hammer: {
    id: 'knight_hammer',
    name: 'Warrior',
    health: 150,
    damage: 12, // strong but slow
    attackSpeed: 8 / 4, // 4 frames @ 8fps = 0.5s per attack = 2 attacks/sec
    attackFrameCount: 4,
    attackRange: 55,
    moveSpeed: 50,
    aggroRadius: 180,
    behavior: 'aggressive' as const,
    expReward: 60,
    soulValue: 2,
    loot: {
      scrap: { min: 20, max: 35, chance: 1.0 },
      polymer: { min: 15, max: 25, chance: 0.8 },
      gems: { min: 1, max: 2, chance: 0.25 },
    },
    sprites: {
      idle: 'enemy_warrior_idle',
      run: 'enemy_warrior_run',
      attack: 'enemy_warrior_attack1',
    },
    frameSize: 192,
    scale: 0.5,
  },
  hunter_rifle: {
    id: 'hunter_rifle',
    name: 'Monk',
    health: 70,
    damage: 15, // dangerous ranged
    attackSpeed: 8 / 11, // 11 frames @ 8fps = 1.375s per attack = 0.73 attacks/sec
    attackFrameCount: 11,
    attackRange: 300,
    moveSpeed: 60,
    aggroRadius: 350,
    behavior: 'defensive' as const,
    attackType: 'ranged' as const,
    expReward: 75,
    soulValue: 2,
    loot: {
      scrap: { min: 15, max: 25, chance: 1.0 },
      polymer: { min: 20, max: 30, chance: 0.9 },
      gems: { min: 2, max: 3, chance: 0.35 },
    },
    sprites: {
      idle: 'enemy_monk_idle',
      run: 'enemy_monk_run',
      attack: 'enemy_monk_heal',
    },
    frameSize: 192,
    scale: 0.5,
  },
  // ========== BOSSES ==========
  boss_minotaur: {
    id: 'boss_minotaur',
    name: 'Minotaur',
    health: 500,
    damage: 25,
    attackSpeed: 8 / 12, // 12 frames @ 8fps = 1.5s per attack = 0.67 attacks/sec
    attackFrameCount: 12,
    attackRange: 70,
    moveSpeed: 45,
    aggroRadius: 300,
    behavior: 'aggressive' as const,
    expReward: 300,
    soulValue: 10,
    loot: {
      scrap: { min: 50, max: 80, chance: 1.0 },
      polymer: { min: 40, max: 60, chance: 1.0 },
      gems: { min: 10, max: 15, chance: 1.0 },
    },
    sprites: {
      idle: 'boss_minotaur_idle',
      run: 'boss_minotaur_walk',
      attack: 'boss_minotaur_attack',
    },
    frameSize: 320,
    scale: 0.6,
    isBoss: true,
  },
  boss_troll: {
    id: 'boss_troll',
    name: 'Troll',
    health: 350,
    damage: 18,
    attackSpeed: 8 / 6, // 6 frames @ 8fps = 0.75s per attack = 1.33 attacks/sec
    attackFrameCount: 6,
    attackRange: 80,
    moveSpeed: 40,
    aggroRadius: 250,
    behavior: 'aggressive' as const,
    expReward: 200,
    soulValue: 7,
    loot: {
      scrap: { min: 40, max: 60, chance: 1.0 },
      polymer: { min: 30, max: 50, chance: 1.0 },
      gems: { min: 5, max: 10, chance: 1.0 },
    },
    sprites: {
      idle: 'boss_troll_idle',
      run: 'boss_troll_walk',
      attack: 'boss_troll_attack',
    },
    frameSize: 384,
    scale: 0.5,
    isBoss: true,
  },
} as const;

export type EnemyType = keyof typeof ENEMY_CONFIGS;
export type EnemyBehavior = 'aggressive' | 'defensive' | 'coward';

// Tower configurations (damage reduced for balance)
export const TOWER_CONFIGS = {
  watchtower_basic: {
    id: 'watchtower_basic',
    name: 'Watchtower',
    health: 200,
    damage: 5, // moderate threat
    attackSpeed: 0.8,
    attackRange: 180,
    expReward: 50,
    loot: {
      scrap: { min: 20, max: 35, chance: 1.0 },
      polymer: { min: 10, max: 20, chance: 0.8 },
      gems: { min: 1, max: 2, chance: 0.3 },
    },
    guardTypes: ['guard_spear'] as EnemyType[],
    guardCount: 1,
  },
  watchtower_advanced: {
    id: 'watchtower_advanced',
    name: 'Guard Tower',
    health: 400,
    damage: 10, // stronger tower
    attackSpeed: 1.0,
    attackRange: 220,
    expReward: 100,
    loot: {
      scrap: { min: 35, max: 50, chance: 1.0 },
      polymer: { min: 20, max: 35, chance: 0.9 },
      gems: { min: 2, max: 4, chance: 0.5 },
    },
    guardTypes: ['guard_spear', 'rogue_crossbow'] as EnemyType[],
    guardCount: 2,
  },
} as const;

export type TowerType = keyof typeof TOWER_CONFIGS;

// Enemy house configurations
export const HOUSE_CONFIGS = {
  house_small: {
    id: 'house_small',
    name: 'Small House',
    health: 150,
    expReward: 40,
    loot: {
      scrap: { min: 15, max: 25, chance: 1.0 },
      polymer: { min: 5, max: 15, chance: 0.6 },
      gems: { min: 0, max: 1, chance: 0.1 },
    },
    spawnTypes: ['peasant_unarmed', 'peasant_club'] as EnemyType[],
    maxSpawns: 3, // Total enemies spawned before depleted
    spawnInterval: 8000, // ms between spawns
  },
  house_medium: {
    id: 'house_medium',
    name: 'House',
    health: 250,
    expReward: 70,
    loot: {
      scrap: { min: 25, max: 40, chance: 1.0 },
      polymer: { min: 15, max: 25, chance: 0.8 },
      gems: { min: 1, max: 2, chance: 0.25 },
    },
    spawnTypes: ['peasant_club', 'guard_spear'] as EnemyType[],
    maxSpawns: 5,
    spawnInterval: 10000,
  },
  house_large: {
    id: 'house_large',
    name: 'Manor',
    health: 400,
    expReward: 120,
    loot: {
      scrap: { min: 40, max: 60, chance: 1.0 },
      polymer: { min: 25, max: 40, chance: 0.9 },
      gems: { min: 2, max: 4, chance: 0.4 },
    },
    spawnTypes: ['guard_spear', 'knight_hammer', 'rogue_crossbow'] as EnemyType[],
    maxSpawns: 8,
    spawnInterval: 12000,
  },
} as const;

export type HouseType = keyof typeof HOUSE_CONFIGS;

// Farm (Recycler) configurations - passive resource generation
export const FARM_CONFIGS = {
  scrap_recycler: {
    id: 'scrap_recycler',
    name: 'Scrap Recycler',
    resourceType: 'scrap' as const,
    baseProductionRate: 2, // Resources per minute
    baseCapacity: 100, // Max stored before collection needed
    buildCost: { scrap: 100, polymer: 30 },
    upgradeCosts: [
      { scrap: 200, polymer: 60 }, // Level 2
      { scrap: 400, polymer: 120 }, // Level 3
      { scrap: 800, polymer: 240 }, // Level 4
      { scrap: 1600, polymer: 480 }, // Level 5
    ],
    productionMultipliers: [1, 1.5, 2, 2.5, 3], // Per level
    capacityMultipliers: [1, 1.5, 2, 2.5, 3],
    maxLevel: 5,
    unlockLevel: 2,
  },
  polymer_recycler: {
    id: 'polymer_recycler',
    name: 'Polymer Recycler',
    resourceType: 'polymer' as const,
    baseProductionRate: 1, // Resources per minute
    baseCapacity: 50,
    buildCost: { scrap: 150, polymer: 100 },
    upgradeCosts: [
      { scrap: 300, polymer: 200 },
      { scrap: 600, polymer: 400 },
      { scrap: 1200, polymer: 800 },
      { scrap: 2400, polymer: 1600 },
    ],
    productionMultipliers: [1, 1.5, 2, 2.5, 3],
    capacityMultipliers: [1, 1.5, 2, 2.5, 3],
    maxLevel: 5,
    unlockLevel: 4,
  },
  gem_refinery: {
    id: 'gem_refinery',
    name: 'Gem Refinery',
    resourceType: 'gems' as const,
    baseProductionRate: 0.2, // Resources per minute (1 gem every 5 minutes)
    baseCapacity: 10,
    buildCost: { scrap: 300, polymer: 200, gems: 10 },
    upgradeCosts: [
      { scrap: 600, polymer: 400, gems: 20 },
      { scrap: 1200, polymer: 800, gems: 40 },
      { scrap: 2400, polymer: 1600, gems: 80 },
      { scrap: 4800, polymer: 3200, gems: 160 },
    ],
    productionMultipliers: [1, 1.5, 2, 2.5, 3],
    capacityMultipliers: [1, 1.5, 2, 2.5, 3],
    maxLevel: 5,
    unlockLevel: 8,
  },
} as const;

export type FarmType = keyof typeof FARM_CONFIGS;
