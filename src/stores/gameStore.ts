import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { gameEvents } from '../game/managers/EventManager';

// State interfaces for UI consumption
interface PlayerStats {
  level: number;
  currentXp: number;
  xpToNextLevel: number;
  currentHp: number;
  maxHp: number;
}

interface Resources {
  scrap: number;
  polymer: number;
  gems: number;
  souls: number;
}

interface Cargo {
  scrap: number;
  polymer: number;
  gems: number;
  current: number;
  max: number;
}

interface ArmyCount {
  current: number;
  max: number;
}

interface CurrentQuest {
  id: string;
  title: string;
  description: string;
  progress?: number;
  target?: number;
}

interface UpgradeLevels {
  [key: string]: number;
}

export interface GameState {
  // Player
  playerStats: PlayerStats;

  // Resources (in storage)
  resources: Resources;

  // Cargo (carried by player)
  cargo: Cargo;

  // Army
  armyCount: ArmyCount;

  // Upgrade levels
  upgradeLevels: UpgradeLevels;

  // Current quest
  currentQuest: CurrentQuest | null;

  // UI state
  isModalOpen: boolean;
  currentModal: string | null;
  modalData: unknown;

  // Game state
  isPaused: boolean;
  currentLocation: string;

  // Actions
  updatePlayerHealth: (current: number, max: number) => void;
  updatePlayerLevel: (level: number, exp: number, toNext: number) => void;
  addXp: (amount: number) => void;
  addResourceToCargo: (type: string, amount: number) => void;
  depositCargoToStorage: () => void;
  addSoul: (amount: number) => void;
  updateStorage: (storage: { scrap: number; polymer: number; gems: number; souls: number }) => void;
  addToStorage: (type: 'scrap' | 'polymer' | 'gems' | 'souls', amount: number) => void;
  updateArmy: (count: number, limit: number) => void;
  purchaseUpgrade: (upgradeId: string, cost: { scrap: number; polymer: number }) => void;
  updateQuest: (quest: CurrentQuest | null) => void;
  openModal: (modal: string, data?: unknown) => void;
  closeModal: () => void;
  setLocation: (location: string) => void;
  setPaused: (paused: boolean) => void;
}

const CARGO_MAX = 50;
const XP_PER_LEVEL = 100;

// Persistent state keys that will be saved to localStorage
interface PersistedState {
  playerStats: PlayerStats;
  resources: Resources;
  upgradeLevels: UpgradeLevels;
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
  // Initial state
  playerStats: {
    level: 1,
    currentXp: 0,
    xpToNextLevel: XP_PER_LEVEL,
    currentHp: 100,
    maxHp: 100,
  },

  resources: {
    scrap: 0,
    polymer: 0,
    gems: 0,
    souls: 0,
  },

  cargo: {
    scrap: 0,
    polymer: 0,
    gems: 0,
    current: 0,
    max: CARGO_MAX,
  },

  armyCount: {
    current: 0,
    max: 5,
  },

  upgradeLevels: {},

  currentQuest: {
    id: 'tutorial_01',
    title: 'First Steps',
    description: 'Kill an enemy',
    progress: 0,
    target: 1,
  },

  isModalOpen: false,
  currentModal: null,
  modalData: null,

  isPaused: false,
  currentLocation: 'base',

  // Actions
  updatePlayerHealth: (current, max) =>
    set((state) => ({
      playerStats: { ...state.playerStats, currentHp: current, maxHp: max },
    })),

  updatePlayerLevel: (level, exp, toNext) =>
    set((state) => ({
      playerStats: { ...state.playerStats, level, currentXp: exp, xpToNextLevel: toNext },
    })),

  addXp: (amount) => {
    const state = get();
    let newXp = state.playerStats.currentXp + amount;
    let newLevel = state.playerStats.level;
    let xpToNext = state.playerStats.xpToNextLevel;

    // Level up check
    while (newXp >= xpToNext) {
      newXp -= xpToNext;
      newLevel++;
      xpToNext = Math.floor(XP_PER_LEVEL * Math.pow(1.2, newLevel - 1));

      // Emit level up event
      gameEvents.emit('player:level-up', { newLevel });
    }

    set((state) => ({
      playerStats: {
        ...state.playerStats,
        level: newLevel,
        currentXp: newXp,
        xpToNextLevel: xpToNext,
      },
    }));
  },

  addResourceToCargo: (type, amount) => {
    const state = get();
    const currentTotal = state.cargo.current;
    const maxCargo = state.cargo.max;

    // Calculate how much we can actually pick up
    const spaceLeft = maxCargo - currentTotal;
    const actualAmount = Math.min(amount, spaceLeft);

    // Emit cargo full event if no space left
    if (spaceLeft <= 0) {
      gameEvents.emit('cargo:full', undefined);
      return;
    }

    set((state) => {
      const newCargo = { ...state.cargo };

      switch (type) {
        case 'scrap':
          newCargo.scrap += actualAmount;
          break;
        case 'polymer':
          newCargo.polymer += actualAmount;
          break;
        case 'gems':
          newCargo.gems += actualAmount;
          break;
      }

      newCargo.current = newCargo.scrap + newCargo.polymer + newCargo.gems;

      return { cargo: newCargo };
    });
  },

  depositCargoToStorage: () => {
    const state = get();
    const cargo = state.cargo;

    // Nothing to deposit
    if (cargo.current <= 0) return;

    // Transfer cargo to storage
    const newResources = {
      scrap: state.resources.scrap + cargo.scrap,
      polymer: state.resources.polymer + cargo.polymer,
      gems: state.resources.gems + cargo.gems,
      souls: state.resources.souls,
    };

    // Clear cargo
    const newCargo = {
      scrap: 0,
      polymer: 0,
      gems: 0,
      current: 0,
      max: CARGO_MAX,
    };

    // Emit storage updated event for any listeners
    gameEvents.emit('storage:updated', newResources);

    // Emit cargo deposited event with amounts
    gameEvents.emit('cargo:deposited', {
      scrap: cargo.scrap,
      polymer: cargo.polymer,
      gems: cargo.gems,
      total: cargo.current,
    });

    set({
      resources: newResources,
      cargo: newCargo,
    });
  },

  addSoul: (amount) => {
    set((state) => ({
      resources: {
        ...state.resources,
        souls: state.resources.souls + amount,
      },
    }));
  },

  updateStorage: (storage) =>
    set({
      resources: {
        scrap: storage.scrap,
        polymer: storage.polymer,
        gems: storage.gems,
        souls: storage.souls,
      },
    }),

  addToStorage: (type, amount) =>
    set((state) => ({
      resources: {
        ...state.resources,
        [type]: state.resources[type] + amount,
      },
    })),

  updateArmy: (count, limit) =>
    set({
      armyCount: { current: count, max: limit },
    }),

  purchaseUpgrade: (upgradeId, cost) =>
    set((state) => ({
      resources: {
        ...state.resources,
        scrap: state.resources.scrap - cost.scrap,
        polymer: state.resources.polymer - cost.polymer,
      },
      upgradeLevels: {
        ...state.upgradeLevels,
        [upgradeId]: (state.upgradeLevels[upgradeId] || 0) + 1,
      },
    })),

  updateQuest: (quest) => set({ currentQuest: quest }),

  openModal: (modal, data) =>
    set({ isModalOpen: true, currentModal: modal, modalData: data }),

  closeModal: () =>
    set({ isModalOpen: false, currentModal: null, modalData: null }),

  setLocation: (location) => set({ currentLocation: location }),

  setPaused: (paused) => set({ isPaused: paused }),
    }),
    {
      name: 'puppet-master-save',
      // Only persist specific parts of state
      partialize: (state): PersistedState => ({
        playerStats: state.playerStats,
        resources: state.resources,
        upgradeLevels: state.upgradeLevels,
      }),
      // Merge function to handle loading saved state
      merge: (persistedState, currentState) => {
        const saved = persistedState as PersistedState | undefined;
        if (!saved) return currentState;
        return {
          ...currentState,
          playerStats: saved.playerStats ?? currentState.playerStats,
          resources: saved.resources ?? currentState.resources,
          upgradeLevels: saved.upgradeLevels ?? currentState.upgradeLevels,
        };
      },
    }
  )
);

// Setup event listeners to sync with Phaser
let listenersInitialized = false;

export function setupStoreListeners(): void {
  // Prevent multiple listener registrations
  if (listenersInitialized) return;
  listenersInitialized = true;

  gameEvents.on('player:health-changed', (data) => {
    useGameStore.getState().updatePlayerHealth(data.current, data.max);
  });

  gameEvents.on('player:exp-gained', (data) => {
    useGameStore.getState().addXp(data.amount);
  });

  gameEvents.on('player:level-up', (data) => {
    const state = useGameStore.getState();
    useGameStore.getState().updatePlayerLevel(
      data.newLevel,
      state.playerStats.currentXp,
      state.playerStats.xpToNextLevel
    );
  });

  gameEvents.on('resource:collected', (data) => {
    useGameStore.getState().addResourceToCargo(data.type, data.amount);
  });

  gameEvents.on('storage:updated', (data) => {
    useGameStore.getState().updateStorage(data);
  });

  gameEvents.on('army:updated', (data) => {
    useGameStore.getState().updateArmy(data.count, data.limit);
  });

  gameEvents.on('location:changed', (data) => {
    useGameStore.getState().setLocation(data.to);
  });

  gameEvents.on('ui:open-modal', (data) => {
    useGameStore.getState().openModal(data.modal, data.data);
  });

  gameEvents.on('ui:close-modal', () => {
    useGameStore.getState().closeModal();
  });

  gameEvents.on('cargo:deposit-to-storage', () => {
    useGameStore.getState().depositCargoToStorage();
  });

  gameEvents.on('soul:collected', (data: { amount: number }) => {
    useGameStore.getState().addSoul(data.amount);
  });
}

// Function to get saved upgrades and apply them on game load
export function getSavedUpgrades(): { [key: string]: number } {
  return useGameStore.getState().upgradeLevels;
}

// Function to get saved player stats
export function getSavedPlayerStats(): PlayerStats {
  return useGameStore.getState().playerStats;
}
