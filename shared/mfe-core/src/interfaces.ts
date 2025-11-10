/**
 * MFE Abstraction Layer - Core Interfaces
 * Based on the Micro Frontend Abstraction Strategy
 */

/**
 * Standard MFE lifecycle contract
 * Every MFE must implement this interface
 */
export interface MFELifecycle {
  /**
   * Mount the MFE into a container
   */
  mount(container: HTMLElement, context: MFEContext): Promise<MFEInstance>;

  /**
   * Unmount and cleanup
   */
  unmount(instance: MFEInstance): Promise<void>;

  /**
   * Optional: Update context without full remount
   */
  update?(instance: MFEInstance, context: Partial<MFEContext>): Promise<void>;
}

/**
 * Execution context passed to every MFE
 */
export interface MFEContext {
  // Communication
  eventBus: IsolatedEventBus;

  // Routing
  routing: {
    basePath: string;
    navigate: (path: string) => void;
  };

  // Configuration
  config: {
    apiBaseUrl: string;
    featureFlags: Record<string, boolean>;
  };

  // Metadata
  metadata: {
    mfeName: string;
    version: string;
    framework: string;
  };
}

/**
 * Instance returned by mount()
 */
export interface MFEInstance {
  /** Internal framework-specific reference */
  _internal: any;

  /** Unique instance ID */
  id: string;

  /** MFE name */
  mfeName: string;

  /** When it was mounted */
  mountedAt: Date;

  /** Health check function */
  isHealthy: () => boolean;

  /** Get detailed health status (optional, for telemetry) */
  getHealth?: () => any;

  /** Get telemetry summary (optional, for telemetry) */
  getTelemetry?: () => any;
}

/**
 * Event bus interface for cross-MFE communication
 */
export interface IsolatedEventBus {
  /**
   * Subscribe to an event
   * Returns unsubscribe function
   */
  subscribe<T = any>(event: string, handler: (payload: T) => void): () => void;

  /**
   * Publish an event
   */
  publish<T = any>(event: string, payload: T): void;

  /**
   * Get namespace for this MFE
   */
  getNamespace(): string;
}

/**
 * Abstract loader interface
 * Allows swapping composition mechanisms (Module Federation → ES Modules → etc.)
 */
export interface MFELoader {
  /**
   * Load an MFE and return its lifecycle interface
   */
  load(config: MFELoadConfig): Promise<MFELifecycle>;

  /**
   * Check if an MFE is already loaded
   */
  isLoaded(mfeName: string): boolean;

  /**
   * Unload an MFE
   */
  unload(mfeName: string): Promise<void>;
}

/**
 * Configuration for loading an MFE
 */
export interface MFELoadConfig {
  /** MFE name */
  name: string;

  /** Remote URL (e.g., http://localhost:5001/remoteEntry.js) */
  remoteUrl: string;

  /** Module to load (e.g., './App') */
  module: string;

  /** Scope name for Module Federation */
  scope?: string;

  /** Framework type */
  framework: 'react' | 'angular' | 'vue' | 'svelte';

  /** Version */
  version: string;
}

/**
 * Message event for cross-framework communication
 */
export interface MessageEvent {
  from: string;
  message: string;
  timestamp: Date;
}
