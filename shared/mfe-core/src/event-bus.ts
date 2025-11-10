import { IsolatedEventBus } from './interfaces';

/**
 * Isolated Event Bus Implementation
 * Each MFE gets its own namespaced event bus
 */
export class NamespacedEventBus implements IsolatedEventBus {
  private namespace: string;
  private subscriptions: Map<string, Set<Function>> = new Map();

  constructor(namespace: string) {
    this.namespace = namespace;
  }

  subscribe<T = any>(event: string, handler: (payload: T) => void): () => void {
    const fullEvent = this.getFullEventName(event);

    if (!this.subscriptions.has(fullEvent)) {
      this.subscriptions.set(fullEvent, new Set());
    }

    this.subscriptions.get(fullEvent)!.add(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.subscriptions.get(fullEvent);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.subscriptions.delete(fullEvent);
        }
      }
    };
  }

  publish<T = any>(event: string, payload: T): void {
    const fullEvent = this.getFullEventName(event);
    const handlers = this.subscriptions.get(fullEvent);

    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(payload);
        } catch (error) {
          console.error(
            `[EventBus] Error in handler for ${fullEvent}:`,
            error
          );
        }
      });
    }
  }

  getNamespace(): string {
    return this.namespace;
  }

  /**
   * Get full event name with namespace
   */
  private getFullEventName(event: string): string {
    // Allow cross-MFE communication if event starts with '@'
    if (event.startsWith('@')) {
      return event.substring(1);
    }
    return `${this.namespace}:${event}`;
  }

  /**
   * Cleanup all subscriptions
   */
  destroy(): void {
    this.subscriptions.clear();
  }
}

/**
 * Global Event Bus for cross-MFE communication
 */
export class GlobalEventBus {
  private static instance: GlobalEventBus;
  private subscriptions: Map<string, Set<Function>> = new Map();

  private constructor() {}

  static getInstance(): GlobalEventBus {
    if (!GlobalEventBus.instance) {
      GlobalEventBus.instance = new GlobalEventBus();
    }
    return GlobalEventBus.instance;
  }

  /**
   * Create a namespaced event bus for an MFE
   */
  createNamespacedBus(namespace: string): NamespacedEventBus {
    return new NamespacedEventBus(namespace);
  }

  /**
   * Subscribe to global events (across all MFEs)
   */
  subscribe<T = any>(event: string, handler: (payload: T) => void): () => void {
    if (!this.subscriptions.has(event)) {
      this.subscriptions.set(event, new Set());
    }

    this.subscriptions.get(event)!.add(handler);

    return () => {
      const handlers = this.subscriptions.get(event);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.subscriptions.delete(event);
        }
      }
    };
  }

  /**
   * Publish global event
   */
  publish<T = any>(event: string, payload: T): void {
    const handlers = this.subscriptions.get(event);

    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(payload);
        } catch (error) {
          console.error(`[GlobalEventBus] Error in handler for ${event}:`, error);
        }
      });
    }
  }
}
