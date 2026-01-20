// Save data types

export interface SaveData {
  version: string;
  timestamp: number;

  player: PlayerSaveData;
  resources: ResourcesSaveData;
  buildings: BuildingsSaveData;
  army: ArmySaveData;
  unitUpgrades: Record<string, number>;
  world: WorldSaveData;
  quests: QuestsSaveData;
  settings: SettingsSaveData;
}

export interface PlayerSaveData {
  level: number;
  exp: number;
  position: { x: number; y: number };
  currentLocation: string;
  upgrades: Record<string, number>;
}

export interface ResourcesSaveData {
  // In cargo
  cargoScrap: number;
  cargoPolymer: number;
  cargoGems: number;

  // In storage
  storedScrap: number;
  storedPolymer: number;
  storedGems: number;
  storedSouls: number;
}

export interface BuildingsSaveData {
  storageLevel: number;
  workbenchLevel: number;
  farms: {
    slot1: FarmSaveData | null;
    slot2: FarmSaveData | null;
  };
}

export interface FarmSaveData {
  type: 'scrap' | 'polymer';
  tier: number;
  stored: number;
  lastUpdate: number;
}

export interface ArmySaveData {
  units: SavedUnit[];
  productionQueue: ProductionQueueSaveData[];
}

export interface SavedUnit {
  id: string;
  type: string;
  currentHealth: number;
}

export interface ProductionQueueSaveData {
  unitType: string;
  startTime: number;
  duration: number;
}

export interface WorldSaveData {
  unlockedLocations: string[];
  destroyedStructures: string[];
  clearedDeposits: { id: string; respawnAt: number }[];
}

export interface QuestsSaveData {
  active: ActiveQuestSaveData[];
  completed: string[];
}

export interface ActiveQuestSaveData {
  questId: string;
  objectives: Record<string, number>;
}

export interface SettingsSaveData {
  musicVolume: number;
  sfxVolume: number;
  vibration: boolean;
  showDamageNumbers: boolean;
}

// Default save data
export const DEFAULT_SAVE: SaveData = {
  version: '1.0.0',
  timestamp: Date.now(),

  player: {
    level: 1,
    exp: 0,
    position: { x: 700, y: 600 },
    currentLocation: 'base',
    upgrades: {},
  },

  resources: {
    cargoScrap: 0,
    cargoPolymer: 0,
    cargoGems: 0,
    storedScrap: 0,
    storedPolymer: 0,
    storedGems: 0,
    storedSouls: 0,
  },

  buildings: {
    storageLevel: 1,
    workbenchLevel: 1,
    farms: {
      slot1: null,
      slot2: null,
    },
  },

  army: {
    units: [],
    productionQueue: [],
  },

  unitUpgrades: {},

  world: {
    unlockedLocations: ['base', 'zone1'],
    destroyedStructures: [],
    clearedDeposits: [],
  },

  quests: {
    active: [],
    completed: [],
  },

  settings: {
    musicVolume: 0.5,
    sfxVolume: 0.7,
    vibration: true,
    showDamageNumbers: true,
  },
};
