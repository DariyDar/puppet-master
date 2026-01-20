// Entity configuration types

import type {
  EnemyBehavior,
  AttackType,
  LootTable,
  ResourceCost,
  Vector2
} from './game';

// Enemy configuration
export interface EnemyConfig {
  id: string;
  name: string;
  description: string;
  stats: {
    health: number;
    damage: number;
    attackSpeed: number;
    attackRange: number;
    moveSpeed: number;
    aggroRadius: number;
  };
  behavior: EnemyBehavior;
  attackType?: AttackType;
  projectile?: string;
  expReward: number;
  soulValue: number;
  corpseLifetime: number;
  loot: LootTable;
  sprites: {
    idle: string;
    walk: string;
    attack: string;
    death: string;
    corpse: string;
  };
  animations?: {
    idle: { frames: number; fps: number };
    walk: { frames: number; fps: number };
    attack: { frames: number; fps: number };
    death: { frames: number; fps: number };
  };
  size: { width: number; height: number };
}

// Unit configuration
export interface UnitConfig {
  id: string;
  name: string;
  description: string;
  stats: {
    health: number;
    damage: number;
    attackSpeed: number;
    attackRange: number;
    moveSpeed: number;
  };
  attackType: AttackType;
  projectile?: string;
  specialAbility: SpecialAbility | null;
  cost: ResourceCost;
  productionTime: number;
  unlockLevel: number;
  sprites: {
    idle: string;
    walk: string;
    attack: string;
    death: string;
    icon: string;
    special?: string;
  };
  size: { width: number; height: number };
}

export interface SpecialAbility {
  type: 'lifesteal' | 'stun' | 'aoe' | 'mind_control';
  value?: number;
  chance?: number;
  duration?: number;
  cooldown?: number;
  radius?: number;
  damagePercent?: number;
  maxTargetHealth?: number;
}

// Enemy group configuration
export interface EnemyGroup {
  id: string;
  name: string;
  enemies: {
    type: string;
    count: number;
  }[];
}

// Spawn point configuration
export interface SpawnPointConfig {
  id: string;
  position: Vector2;
  enemyType: string;
  spawnMode?: 'single' | 'group';
  respawnTime: number;
  maxAlive: number;
}

// World object configurations
export interface ResourceDepositConfig {
  id: string;
  name: string;
  resourceType: 'scrap' | 'polymer' | 'gems';
  health: number;
  amount: { min: number; max: number };
  respawnTime: number;
  size: { width: number; height: number };
}

export interface StructureConfig {
  id: string;
  name: string;
  health: number;
  respawnable: boolean;
  sprites: Record<string, string>;
  size: { width: number; height: number };
}

export interface WatchtowerConfig extends StructureConfig {
  guards: { type: string; count: number }[];
  loot: {
    scrap: [number, number];
    polymer: [number, number];
    gems: [number, number];
  };
}

export interface EnemyHouseConfig extends StructureConfig {
  residents: { type: string; count: number }[];
  alertRadius: number;
  loot: {
    scrap: [number, number];
    polymer: [number, number];
  };
}
