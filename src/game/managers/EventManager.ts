// Event types for TypeScript
export interface GameEventMap {
  // Scene events
  'scene:ready': { scene: string };

  // Player events
  'player:position': { x: number; y: number };
  'player:health-changed': { current: number; max: number };
  'player:died': { position: { x: number; y: number } };
  'player:level-up': { newLevel: number };
  'player:exp-gained': { amount: number; total: number; toNext: number };
  'player:upgrade-purchased': { upgradeId: string; newLevel: number };

  // Joystick events (React -> Phaser)
  'joystick:move': { x: number; y: number; force: number };
  'joystick:stop': undefined;

  // Combat events
  'combat:damage': { x: number; y: number; damage: number; isCritical?: boolean };
  'entity:health-changed': {
    entityId: string;
    x: number;
    y: number;
    current: number;
    max: number;
  };
  'entity:died': { entityId: string; entityType: string; position: { x: number; y: number } };

  // Resource events
  'resource:collected': { type: string; amount: number };
  'resource:delivered': { type: string; amount: number };
  'cargo:updated': { scrap: number; polymer: number; gems: number; current: number; max: number };
  'cargo:deposited': { scrap: number; polymer: number; gems: number; total: number };
  'cargo:deposit-to-storage': undefined;
  'cargo:full': undefined;
  'storage:updated': {
    scrap: number;
    polymer: number;
    gems: number;
    souls: number;
  };
  'deposit:depleted': { depositId: string; resourceType: string; position: { x: number; y: number } };

  // Soul events
  'soul:drain-started': { corpseId: string };
  'soul:drain-progress': { progress: number };
  'soul:drain-completed': { amount: number };
  'soul:drain-cancelled': undefined;
  'soul:collected': { amount: number };

  // Unit events
  'unit:produced': { unitType: string; unitId: string };
  'unit:destroyed': { unitId: string };
  'unit:spawn-request': { unitType: string };
  'unit:died': { unitId: string; unitType: string; position: { x: number; y: number } };
  'army:updated': { count: number; limit: number };
  'army:full': undefined;

  // Production events
  'production:started': { unitType: string; duration: number };
  'production:progress': { unitType: string; progress: number };
  'production:completed': { unitType: string };

  // Workbench events
  'workbench:in-range': { inRange: boolean };

  // Quest events
  'quest:accepted': { questId: string };
  'quest:progress': { questId: string; objectiveId: string; current: number; target: number };
  'quest:completed': { questId: string };
  'quest:rewards-claimed': { questId: string };

  // Location events
  'location:changed': { from: string; to: string };
  'location:transition-start': { target: string };
  'location:transition-complete': { location: string };

  // UI events
  'ui:open-modal': { modal: string; data?: unknown };
  'ui:close-modal': { modal: string };
  'ui:interaction-available': { objectType: string; objectId: string };
  'ui:interaction-unavailable': undefined;

  // Save events
  'save:started': undefined;
  'save:completed': undefined;
  'save:loaded': undefined;
}

type EventHandler<T> = (data: T) => void;

// Simple browser-compatible EventEmitter
class GameEventEmitter {
  private listeners: Map<string, Set<EventHandler<unknown>>> = new Map();

  emit<K extends keyof GameEventMap>(event: K, data: GameEventMap[K]): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  on<K extends keyof GameEventMap>(event: K, handler: EventHandler<GameEventMap[K]>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as EventHandler<unknown>);
  }

  off<K extends keyof GameEventMap>(event: K, handler: EventHandler<GameEventMap[K]>): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler as EventHandler<unknown>);
    }
  }

  once<K extends keyof GameEventMap>(event: K, handler: EventHandler<GameEventMap[K]>): void {
    const onceHandler = (data: GameEventMap[K]) => {
      this.off(event, onceHandler);
      handler(data);
    };
    this.on(event, onceHandler);
  }

  removeAllListeners(event?: keyof GameEventMap): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

// Global event emitter for communication between Phaser and React
export const gameEvents = new GameEventEmitter();
