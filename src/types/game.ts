// Core game types

export type Direction = 'up' | 'down' | 'left' | 'right';

export type EntityType = 'player' | 'enemy' | 'unit' | 'building' | 'object';

export type ResourceType = 'scrap' | 'polymer' | 'gems' | 'souls';

export type PlayerState = 'idle' | 'moving' | 'attacking' | 'soul_draining' | 'dead';

export type EnemyState = 'idle' | 'patrol' | 'chase' | 'attack' | 'flee' | 'return';

export type UnitState = 'follow' | 'attack' | 'return';

export type EnemyBehavior = 'aggressive' | 'defensive' | 'coward';

export type AttackType = 'melee' | 'ranged';

export interface Vector2 {
  x: number;
  y: number;
}

export interface EntityStats {
  health: number;
  maxHealth: number;
  damage: number;
  attackSpeed: number;
  attackRange: number;
  moveSpeed: number;
}

export interface PlayerStats extends EntityStats {
  cargo: number;
  maxCargo: number;
  soulDrainSpeed: number;
}

export interface EnemyStats extends EntityStats {
  aggroRadius: number;
}

export interface Resources {
  scrap: number;
  polymer: number;
  gems: number;
  souls: number;
}

export interface ResourceCost {
  scrap?: number;
  polymer?: number;
  gems?: number;
  souls?: number;
}

export interface CargoState {
  scrap: number;
  polymer: number;
  gems: number;
  maxCapacity: number;
}

export interface LootEntry {
  type: ResourceType;
  min: number;
  max: number;
  chance: number;
}

export interface LootTable {
  guaranteed: LootEntry[];
  random: LootEntry[];
}

// Animation types
export interface AnimationConfig {
  key: string;
  frames: number;
  frameRate: number;
  repeat?: number;
}

export interface SpriteConfig {
  idle: string;
  walk: string;
  attack: string;
  death: string;
}
