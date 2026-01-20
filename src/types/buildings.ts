// Building configuration types

import type { ResourceCost, Vector2 } from './game';

export interface StorageLevel {
  level: number;
  scrapCapacity: number;
  polymerCapacity: number;
  soulsCapacity: number;
  upgradeCost: ResourceCost | null;
}

export interface StorageConfig {
  id: string;
  name: string;
  description: string;
  interactionRadius: number;
  autoCollect: boolean;
  levels: StorageLevel[];
  sprites: Record<string, string>;
  size: { width: number; height: number };
}

export interface WorkbenchLevel {
  level: number;
  productionSlots: number;
  armyLimit: number;
  upgradeCost: ResourceCost | null;
}

export interface WorkbenchConfig {
  id: string;
  name: string;
  description: string;
  interactionRadius: number;
  levels: WorkbenchLevel[];
  sprites: Record<string, string>;
  size: { width: number; height: number };
}

export interface FarmTier {
  tier: number;
  generationRate: number;
  capacity: number;
  buildCost: ResourceCost;
}

export interface FarmConfig {
  id: string;
  name: string;
  description: string;
  resourceType: 'scrap' | 'polymer';
  interactionRadius: number;
  maxOfflineHours: number;
  unlockLevel: number;
  tiers: FarmTier[];
  sprites: Record<string, string>;
  size: { width: number; height: number };
}

// Runtime building state
export interface StorageState {
  level: number;
  storedScrap: number;
  storedPolymer: number;
  storedSouls: number;
}

export interface WorkbenchState {
  level: number;
  queue: ProductionQueueItem[];
}

export interface ProductionQueueItem {
  unitType: string;
  startTime: number;
  duration: number;
}

export interface FarmState {
  type: 'scrap' | 'polymer';
  tier: number;
  stored: number;
  lastUpdate: number;
}

export interface FarmSlot {
  id: string;
  position: Vector2;
  unlockLevel: number;
  farm: FarmState | null;
}
