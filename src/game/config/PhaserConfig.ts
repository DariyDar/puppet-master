import Phaser from 'phaser';
import { BootScene } from '../scenes/BootScene';
import { LoadingScene } from '../scenes/LoadingScene';
import { MainScene } from '../scenes/MainScene';
import { UIScene } from '../scenes/UIScene';

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
        debug: import.meta.env.DEV,
      },
    },
    scene: [BootScene, LoadingScene, MainScene, UIScene],
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
      debug: import.meta.env.DEV,
    },
  },
  scene: [BootScene, LoadingScene, MainScene, UIScene],
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
  PLAYER_BASE_HEALTH: 100,
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

// Unit type configurations
export const UNIT_CONFIGS = {
  creepy_clown: {
    id: 'creepy_clown',
    name: 'Creepy Clown',
    health: 80,
    damage: 15,
    attackSpeed: 1.2,
    attackRange: 45,
    moveSpeed: 85,
    attackType: 'melee' as const,
    cost: { souls: 1, scrap: 50, polymer: 20 },
    productionTime: 30,
    unlockLevel: 1,
  },
  bonnie: {
    id: 'bonnie',
    name: 'Bonnie',
    health: 180,
    damage: 12,
    attackSpeed: 0.8,
    attackRange: 50,
    moveSpeed: 60,
    attackType: 'melee' as const,
    specialAbility: 'lifesteal',
    cost: { souls: 2, scrap: 100, polymer: 50 },
    productionTime: 60,
    unlockLevel: 3,
  },
  foxy: {
    id: 'foxy',
    name: 'Foxy',
    health: 60,
    damage: 30,
    attackSpeed: 1.5,
    attackRange: 40,
    moveSpeed: 120,
    attackType: 'melee' as const,
    specialAbility: 'stun',
    cost: { souls: 2, scrap: 80, polymer: 80 },
    productionTime: 45,
    unlockLevel: 5,
  },
  chica: {
    id: 'chica',
    name: 'Chica',
    health: 70,
    damage: 20,
    attackSpeed: 0.7,
    attackRange: 180,
    moveSpeed: 70,
    attackType: 'ranged' as const,
    specialAbility: 'aoe',
    cost: { souls: 3, scrap: 120, polymer: 100 },
    productionTime: 75,
    unlockLevel: 7,
  },
  puppet: {
    id: 'puppet',
    name: 'Puppet',
    health: 50,
    damage: 8,
    attackSpeed: 1.0,
    attackRange: 120,
    moveSpeed: 100,
    attackType: 'ranged' as const,
    specialAbility: 'mind_control',
    cost: { souls: 4, scrap: 150, polymer: 150 },
    productionTime: 90,
    unlockLevel: 10,
  },
} as const;
