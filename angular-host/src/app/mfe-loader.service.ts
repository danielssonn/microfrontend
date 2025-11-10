import { Injectable } from '@angular/core';
import {
  MFELoader,
  MFELoadConfig,
  MFELifecycle,
  MFEContext,
  MFEInstance,
  ModuleFederationLoader,
  GlobalEventBus
} from 'mfe-core';
import { EventBusService } from './event-bus.service';

/**
 * Angular service that wraps the MFE abstraction layer
 * Provides a convenient way to load MFEs in Angular
 */
@Injectable({
  providedIn: 'root'
})
export class MFELoaderService {
  private loader: MFELoader;
  private loadedInstances: Map<string, MFEInstance> = new Map();
  private lifecycleCache: Map<string, MFELifecycle> = new Map();  // Cache lifecycles to avoid reloading
  private globalEventBus = GlobalEventBus.getInstance();

  constructor(private eventBusService: EventBusService) {
    // Initialize with Module Federation loader
    this.loader = new ModuleFederationLoader();
    console.log('[MFELoaderService] Initialized with Module Federation loader');
  }

  /**
   * Load and mount an MFE
   */
  async loadMFE(
    config: MFELoadConfig,
    container: HTMLElement
  ): Promise<MFEInstance> {
    console.log(`[MFELoaderService] Loading MFE: ${config.name}`);

    try {
      // Load the MFE lifecycle
      const lifecycle = await this.loader.load(config);

      // Create context for the MFE
      const context: MFEContext = {
        eventBus: this.eventBusService as any, // Use existing EventBusService
        routing: {
          basePath: `/${config.name}`,
          navigate: (path: string) => {
            console.log(`[MFELoaderService] Navigate to: ${path}`);
            // TODO: Integrate with Angular router
          }
        },
        config: {
          apiBaseUrl: '/api',
          featureFlags: {}
        },
        metadata: {
          mfeName: config.name,
          version: config.version,
          framework: config.framework
        }
      };

      // Cache the lifecycle for future unloads
      this.lifecycleCache.set(config.name, lifecycle);

      // Mount the MFE
      const instance = await lifecycle.mount(container, context);
      this.loadedInstances.set(config.name, instance);

      console.log(`[MFELoaderService] Successfully loaded and mounted: ${config.name}`);
      return instance;
    } catch (error) {
      console.error(`[MFELoaderService] Failed to load MFE ${config.name}:`, error);
      throw error;
    }
  }

  /**
   * Unmount an MFE
   */
  async unloadMFE(mfeName: string): Promise<void> {
    console.log(`[MFELoaderService] Unloading MFE: ${mfeName}`);

    const instance = this.loadedInstances.get(mfeName);
    if (!instance) {
      console.warn(`[MFELoaderService] MFE ${mfeName} not found in loaded instances`);
      return;
    }

    const lifecycle = this.lifecycleCache.get(mfeName);
    if (!lifecycle) {
      console.warn(`[MFELoaderService] Lifecycle for ${mfeName} not found in cache`);
      return;
    }

    try {
      // Unmount the MFE instance
      await lifecycle.unmount(instance);

      // Clean up our caches
      this.loadedInstances.delete(mfeName);
      this.lifecycleCache.delete(mfeName);

      // Unload from the loader (clears loader's cache)
      await this.loader.unload(mfeName);

      console.log(`[MFELoaderService] Successfully unloaded: ${mfeName}`);
    } catch (error) {
      console.error(`[MFELoaderService] Failed to unload MFE ${mfeName}:`, error);
      throw error;
    }
  }

  /**
   * Unload all loaded MFEs
   */
  async unloadAll(): Promise<void> {
    console.log('[MFELoaderService] Unloading all MFEs');

    const mfeNames = Array.from(this.loadedInstances.keys());
    const promises = mfeNames.map(name => this.unloadMFE(name));

    try {
      await Promise.all(promises);
      console.log('[MFELoaderService] All MFEs unloaded');
    } catch (error) {
      console.error('[MFELoaderService] Error unloading all MFEs:', error);
      throw error;
    }
  }

  /**
   * Check if an MFE is loaded
   */
  isLoaded(mfeName: string): boolean {
    return this.loadedInstances.has(mfeName);
  }

  /**
   * Get all loaded MFE instances
   */
  getLoadedMFEs(): Map<string, MFEInstance> {
    return new Map(this.loadedInstances);
  }
}
