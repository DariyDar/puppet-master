import { gameEvents } from './EventManager';

// Quest objective types
export type QuestObjectiveType =
  | 'kill_enemies' // Kill N enemies
  | 'kill_enemy_type' // Kill N enemies of specific type
  | 'collect_resource' // Collect N of resource type
  | 'deposit_resources' // Deposit N resources to storage
  | 'drain_souls' // Drain N souls from corpses
  | 'build_units' // Build N units
  | 'build_unit_type' // Build N units of specific type
  | 'destroy_tower' // Destroy N towers
  | 'destroy_house' // Destroy N houses
  | 'reach_level' // Reach player level N
  | 'upgrade_stat' // Upgrade any stat
  | 'visit_zone' // Visit zone N
  | 'move_to_point'; // Move to specific coordinates

// Quest objective definition
export interface QuestObjective {
  id: string;
  type: QuestObjectiveType;
  description: string;
  target: number;
  current: number;
  // Optional filters
  enemyType?: string;
  resourceType?: string;
  unitType?: string;
  zoneId?: number;
  position?: { x: number; y: number; radius: number };
}

// Quest reward types
export interface QuestReward {
  type: 'scrap' | 'polymer' | 'gems' | 'souls' | 'exp';
  amount: number;
}

// Quest definition
export interface Quest {
  id: string;
  title: string;
  description: string;
  objectives: QuestObjective[];
  rewards: QuestReward[];
  unlockLevel: number; // Player level required to unlock
  prerequisiteQuestId?: string; // Quest that must be completed first
  isRepeatable: boolean;
  category: 'tutorial' | 'main' | 'side' | 'daily';
}

// Quest state
export type QuestState = 'locked' | 'available' | 'active' | 'completed' | 'claimed';

// Active quest data
export interface ActiveQuest extends Quest {
  state: QuestState;
  startedAt?: number;
  completedAt?: number;
}

// Quest configurations
export const QUEST_CONFIGS: Quest[] = [
  // ========== TUTORIAL QUESTS ==========
  {
    id: 'tutorial_01_move',
    title: 'First Steps',
    description: 'Learn to move around. Use WASD or arrow keys.',
    objectives: [
      {
        id: 'move_1',
        type: 'move_to_point',
        description: 'Move away from the base',
        target: 1,
        current: 0,
        position: { x: 400, y: 300, radius: 50 },
      },
    ],
    rewards: [{ type: 'exp', amount: 10 }],
    unlockLevel: 1,
    isRepeatable: false,
    category: 'tutorial',
  },
  {
    id: 'tutorial_02_collect',
    title: 'Resource Gathering',
    description: 'Collect scrap metal from the environment.',
    objectives: [
      {
        id: 'collect_1',
        type: 'collect_resource',
        description: 'Collect 10 scrap',
        target: 10,
        current: 0,
        resourceType: 'scrap',
      },
    ],
    rewards: [{ type: 'exp', amount: 15 }],
    unlockLevel: 1,
    prerequisiteQuestId: 'tutorial_01_move',
    isRepeatable: false,
    category: 'tutorial',
  },
  {
    id: 'tutorial_03_deposit',
    title: 'Back to Base',
    description: 'Return to the storage and deposit your resources.',
    objectives: [
      {
        id: 'deposit_1',
        type: 'deposit_resources',
        description: 'Deposit resources at storage',
        target: 10,
        current: 0,
      },
    ],
    rewards: [
      { type: 'exp', amount: 20 },
      { type: 'scrap', amount: 20 },
    ],
    unlockLevel: 1,
    prerequisiteQuestId: 'tutorial_02_collect',
    isRepeatable: false,
    category: 'tutorial',
  },
  {
    id: 'tutorial_04_kill',
    title: 'First Blood',
    description: 'Enemies roam outside the base. Eliminate one.',
    objectives: [
      {
        id: 'kill_1',
        type: 'kill_enemies',
        description: 'Kill an enemy',
        target: 1,
        current: 0,
      },
    ],
    rewards: [
      { type: 'exp', amount: 25 },
      { type: 'scrap', amount: 15 },
    ],
    unlockLevel: 1,
    prerequisiteQuestId: 'tutorial_03_deposit',
    isRepeatable: false,
    category: 'tutorial',
  },
  {
    id: 'tutorial_05_soul',
    title: 'Soul Harvester',
    description: 'Stand near a corpse to drain its soul.',
    objectives: [
      {
        id: 'drain_1',
        type: 'drain_souls',
        description: 'Drain a soul from a corpse',
        target: 1,
        current: 0,
      },
    ],
    rewards: [
      { type: 'exp', amount: 30 },
      { type: 'souls', amount: 1 },
    ],
    unlockLevel: 1,
    prerequisiteQuestId: 'tutorial_04_kill',
    isRepeatable: false,
    category: 'tutorial',
  },
  {
    id: 'tutorial_06_unit',
    title: 'Army Builder',
    description: 'Use the workbench to create your first animatronic unit.',
    objectives: [
      {
        id: 'build_1',
        type: 'build_units',
        description: 'Build a unit at the workbench',
        target: 1,
        current: 0,
      },
    ],
    rewards: [
      { type: 'exp', amount: 40 },
      { type: 'polymer', amount: 30 },
    ],
    unlockLevel: 1,
    prerequisiteQuestId: 'tutorial_05_soul',
    isRepeatable: false,
    category: 'tutorial',
  },
  {
    id: 'tutorial_07_tower',
    title: 'Tower Assault',
    description: 'Attack and destroy an enemy watchtower with your army.',
    objectives: [
      {
        id: 'destroy_1',
        type: 'destroy_tower',
        description: 'Destroy a watchtower',
        target: 1,
        current: 0,
      },
    ],
    rewards: [
      { type: 'exp', amount: 50 },
      { type: 'scrap', amount: 50 },
      { type: 'polymer', amount: 25 },
    ],
    unlockLevel: 1,
    prerequisiteQuestId: 'tutorial_06_unit',
    isRepeatable: false,
    category: 'tutorial',
  },

  // ========== EARLY GAME QUESTS ==========
  {
    id: 'early_01_upgrade',
    title: 'Self Improvement',
    description: 'Upgrade one of your stats.',
    objectives: [
      {
        id: 'upgrade_1',
        type: 'upgrade_stat',
        description: 'Purchase an upgrade',
        target: 1,
        current: 0,
      },
    ],
    rewards: [
      { type: 'exp', amount: 30 },
      { type: 'scrap', amount: 30 },
    ],
    unlockLevel: 2,
    prerequisiteQuestId: 'tutorial_07_tower',
    isRepeatable: false,
    category: 'main',
  },
  {
    id: 'early_02_hunter',
    title: 'Hunter',
    description: 'Kill multiple enemies to gain experience.',
    objectives: [
      {
        id: 'kill_many',
        type: 'kill_enemies',
        description: 'Kill 10 enemies',
        target: 10,
        current: 0,
      },
    ],
    rewards: [
      { type: 'exp', amount: 50 },
      { type: 'gems', amount: 2 },
    ],
    unlockLevel: 2,
    isRepeatable: false,
    category: 'main',
  },
  {
    id: 'early_03_stockpile',
    title: 'Stockpile',
    description: 'Accumulate resources in storage.',
    objectives: [
      {
        id: 'store_scrap',
        type: 'deposit_resources',
        description: 'Store 100 scrap',
        target: 100,
        current: 0,
        resourceType: 'scrap',
      },
    ],
    rewards: [
      { type: 'exp', amount: 40 },
      { type: 'polymer', amount: 50 },
    ],
    unlockLevel: 2,
    isRepeatable: false,
    category: 'main',
  },
  {
    id: 'early_04_army',
    title: 'Growing Army',
    description: 'Build more units to strengthen your forces.',
    objectives: [
      {
        id: 'build_many',
        type: 'build_units',
        description: 'Build 3 units',
        target: 3,
        current: 0,
      },
    ],
    rewards: [
      { type: 'exp', amount: 60 },
      { type: 'souls', amount: 2 },
    ],
    unlockLevel: 3,
    isRepeatable: false,
    category: 'main',
  },
  {
    id: 'early_05_clearance',
    title: 'Area Clearance',
    description: 'Destroy enemy structures to secure the area.',
    objectives: [
      {
        id: 'destroy_house',
        type: 'destroy_house',
        description: 'Destroy 2 enemy houses',
        target: 2,
        current: 0,
      },
    ],
    rewards: [
      { type: 'exp', amount: 70 },
      { type: 'scrap', amount: 80 },
      { type: 'polymer', amount: 40 },
    ],
    unlockLevel: 3,
    isRepeatable: false,
    category: 'main',
  },
  {
    id: 'early_06_level5',
    title: 'Rising Power',
    description: 'Reach level 5 to unlock new content.',
    objectives: [
      {
        id: 'reach_level',
        type: 'reach_level',
        description: 'Reach level 5',
        target: 5,
        current: 0,
      },
    ],
    rewards: [
      { type: 'exp', amount: 100 },
      { type: 'gems', amount: 5 },
    ],
    unlockLevel: 3,
    isRepeatable: false,
    category: 'main',
  },
  {
    id: 'early_07_zone2',
    title: 'New Horizons',
    description: 'Explore the dangerous Zone 2 through the portal.',
    objectives: [
      {
        id: 'visit_zone2',
        type: 'visit_zone',
        description: 'Enter Zone 2',
        target: 1,
        current: 0,
        zoneId: 2,
      },
    ],
    rewards: [
      { type: 'exp', amount: 80 },
      { type: 'scrap', amount: 100 },
      { type: 'polymer', amount: 50 },
      { type: 'gems', amount: 3 },
    ],
    unlockLevel: 5,
    isRepeatable: false,
    category: 'main',
  },
];

// QuestManager class
class QuestManager {
  private quests: Map<string, ActiveQuest> = new Map();
  private currentQuestId: string | null = null;
  private completedQuestIds: Set<string> = new Set();
  private playerLevel: number = 1;

  constructor() {
    this.initializeQuests();
    this.setupEventListeners();
  }

  private initializeQuests(): void {
    // Initialize all quests with their initial state
    QUEST_CONFIGS.forEach((quest) => {
      const activeQuest: ActiveQuest = {
        ...quest,
        objectives: quest.objectives.map((obj) => ({ ...obj, current: 0 })),
        state: 'locked',
      };
      this.quests.set(quest.id, activeQuest);
    });

    // Unlock first tutorial quest
    this.updateQuestAvailability();
  }

  private setupEventListeners(): void {
    // Listen for enemy kills
    gameEvents.on('entity:died', (data) => {
      if (data.entityType === 'enemy') {
        this.updateObjectives('kill_enemies', 1);
        // Could also check for specific enemy type
      }
    });

    // Listen for resource collection
    gameEvents.on('resource:collected', (data) => {
      this.updateObjectives('collect_resource', data.amount, { resourceType: data.type });
    });

    // Listen for cargo deposit
    gameEvents.on('cargo:deposited', (data) => {
      const total = data.scrap + data.polymer + data.gems;
      this.updateObjectives('deposit_resources', total);
      this.updateObjectives('deposit_resources', data.scrap, { resourceType: 'scrap' });
      this.updateObjectives('deposit_resources', data.polymer, { resourceType: 'polymer' });
      this.updateObjectives('deposit_resources', data.gems, { resourceType: 'gems' });
    });

    // Listen for soul drain
    gameEvents.on('soul:drain-completed', (data) => {
      this.updateObjectives('drain_souls', data.amount);
    });

    // Listen for unit production
    gameEvents.on('unit:produced', (data) => {
      this.updateObjectives('build_units', 1);
      this.updateObjectives('build_unit_type', 1, { unitType: data.unitType });
    });

    // Listen for level up
    gameEvents.on('player:level-up', (data) => {
      this.playerLevel = data.newLevel;
      this.updateObjectives('reach_level', data.newLevel, {}, true); // Set absolute value
      this.updateQuestAvailability();
    });

    // Listen for upgrade purchase
    gameEvents.on('player:upgrade-purchased', () => {
      this.updateObjectives('upgrade_stat', 1);
    });

    // Listen for zone change
    gameEvents.on('zone:changed', (data) => {
      this.updateObjectives('visit_zone', 1, { zoneId: data.zone });
    });

    // Listen for structure destruction (we need to add these events)
    // Tower destruction
    gameEvents.on('structure:destroyed', (data: { structureType: string }) => {
      if (data.structureType === 'tower') {
        this.updateObjectives('destroy_tower', 1);
      } else if (data.structureType === 'house') {
        this.updateObjectives('destroy_house', 1);
      }
    });
  }

  private updateQuestAvailability(): void {
    this.quests.forEach((quest, questId) => {
      if (quest.state === 'locked') {
        // Check if quest can be unlocked
        const levelMet = this.playerLevel >= quest.unlockLevel;
        const prerequisiteMet = !quest.prerequisiteQuestId || this.completedQuestIds.has(quest.prerequisiteQuestId);

        if (levelMet && prerequisiteMet) {
          quest.state = 'available';
          // Auto-accept tutorial quests
          if (quest.category === 'tutorial' && !this.currentQuestId) {
            this.acceptQuest(questId);
          }
        }
      }
    });
  }

  public acceptQuest(questId: string): boolean {
    const quest = this.quests.get(questId);
    if (!quest || quest.state !== 'available') {
      return false;
    }

    quest.state = 'active';
    quest.startedAt = Date.now();
    this.currentQuestId = questId;

    gameEvents.emit('quest:accepted', { questId });
    this.emitCurrentQuestUpdate();

    return true;
  }

  private updateObjectives(
    type: QuestObjectiveType,
    amount: number,
    filter: { resourceType?: string; unitType?: string; enemyType?: string; zoneId?: number } = {},
    setAbsolute: boolean = false
  ): void {
    if (!this.currentQuestId) return;

    const quest = this.quests.get(this.currentQuestId);
    if (!quest || quest.state !== 'active') return;

    let questUpdated = false;

    quest.objectives.forEach((objective) => {
      if (objective.type !== type) return;

      // Check filters
      if (filter.resourceType && objective.resourceType !== filter.resourceType) return;
      if (filter.unitType && objective.unitType !== filter.unitType) return;
      if (filter.enemyType && objective.enemyType !== filter.enemyType) return;
      if (filter.zoneId && objective.zoneId !== filter.zoneId) return;

      // Update progress
      if (setAbsolute) {
        objective.current = Math.max(objective.current, amount);
      } else {
        objective.current = Math.min(objective.current + amount, objective.target);
      }

      questUpdated = true;

      gameEvents.emit('quest:progress', {
        questId: this.currentQuestId!,
        objectiveId: objective.id,
        current: objective.current,
        target: objective.target,
      });
    });

    if (questUpdated) {
      this.checkQuestCompletion(quest);
      this.emitCurrentQuestUpdate();
    }
  }

  public updateMoveObjective(playerX: number, playerY: number): void {
    if (!this.currentQuestId) return;

    const quest = this.quests.get(this.currentQuestId);
    if (!quest || quest.state !== 'active') return;

    quest.objectives.forEach((objective) => {
      if (objective.type !== 'move_to_point' || !objective.position) return;

      const distance = Math.sqrt(
        Math.pow(playerX - objective.position.x, 2) + Math.pow(playerY - objective.position.y, 2)
      );

      if (distance <= objective.position.radius && objective.current < objective.target) {
        objective.current = objective.target;

        gameEvents.emit('quest:progress', {
          questId: this.currentQuestId!,
          objectiveId: objective.id,
          current: objective.current,
          target: objective.target,
        });

        this.checkQuestCompletion(quest);
        this.emitCurrentQuestUpdate();
      }
    });
  }

  private checkQuestCompletion(quest: ActiveQuest): void {
    const allComplete = quest.objectives.every((obj) => obj.current >= obj.target);

    if (allComplete && quest.state === 'active') {
      quest.state = 'completed';
      quest.completedAt = Date.now();

      gameEvents.emit('quest:completed', { questId: quest.id });
    }
  }

  public claimRewards(questId: string): QuestReward[] | null {
    const quest = this.quests.get(questId);
    if (!quest || quest.state !== 'completed') {
      return null;
    }

    quest.state = 'claimed';
    this.completedQuestIds.add(questId);

    // Clear current quest if this was it
    if (this.currentQuestId === questId) {
      this.currentQuestId = null;
    }

    gameEvents.emit('quest:rewards-claimed', { questId });

    // Update availability for other quests
    this.updateQuestAvailability();

    // Auto-accept next tutorial quest if available
    if (quest.category === 'tutorial') {
      const nextTutorial = Array.from(this.quests.values()).find(
        (q) => q.category === 'tutorial' && q.state === 'available'
      );
      if (nextTutorial) {
        this.acceptQuest(nextTutorial.id);
      }
    }

    return quest.rewards;
  }

  public getCurrentQuest(): ActiveQuest | null {
    if (!this.currentQuestId) return null;
    return this.quests.get(this.currentQuestId) || null;
  }

  public getAvailableQuests(): ActiveQuest[] {
    return Array.from(this.quests.values()).filter((q) => q.state === 'available');
  }

  public getActiveQuests(): ActiveQuest[] {
    return Array.from(this.quests.values()).filter((q) => q.state === 'active');
  }

  public getCompletedQuests(): ActiveQuest[] {
    return Array.from(this.quests.values()).filter((q) => q.state === 'completed' || q.state === 'claimed');
  }

  private emitCurrentQuestUpdate(): void {
    const quest = this.getCurrentQuest();
    if (quest) {
      // Calculate overall progress
      const totalTarget = quest.objectives.reduce((sum, obj) => sum + obj.target, 0);
      const totalCurrent = quest.objectives.reduce((sum, obj) => sum + obj.current, 0);

      // Emit for HUD update
      gameEvents.emit('quest:progress', {
        questId: quest.id,
        objectiveId: 'overall',
        current: totalCurrent,
        target: totalTarget,
      });
    }
  }

  // Save/Load state
  public getState(): {
    currentQuestId: string | null;
    completedQuestIds: string[];
    questProgress: { [questId: string]: { [objectiveId: string]: number } };
  } {
    const questProgress: { [questId: string]: { [objectiveId: string]: number } } = {};

    this.quests.forEach((quest, questId) => {
      if (quest.state === 'active') {
        questProgress[questId] = {};
        quest.objectives.forEach((obj) => {
          questProgress[questId][obj.id] = obj.current;
        });
      }
    });

    return {
      currentQuestId: this.currentQuestId,
      completedQuestIds: Array.from(this.completedQuestIds),
      questProgress,
    };
  }

  public loadState(state: {
    currentQuestId: string | null;
    completedQuestIds: string[];
    questProgress: { [questId: string]: { [objectiveId: string]: number } };
  }): void {
    // Restore completed quests
    this.completedQuestIds = new Set(state.completedQuestIds);

    // Mark completed quests
    state.completedQuestIds.forEach((questId) => {
      const quest = this.quests.get(questId);
      if (quest) {
        quest.state = 'claimed';
      }
    });

    // Restore quest progress
    Object.entries(state.questProgress).forEach(([questId, progress]) => {
      const quest = this.quests.get(questId);
      if (quest) {
        quest.state = 'active';
        quest.objectives.forEach((obj) => {
          if (progress[obj.id] !== undefined) {
            obj.current = progress[obj.id];
          }
        });
      }
    });

    // Set current quest
    this.currentQuestId = state.currentQuestId;

    // Update availability
    this.updateQuestAvailability();
  }
}

// Export singleton instance
export const questManager = new QuestManager();
