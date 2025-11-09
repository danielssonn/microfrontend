import { MFELoader, MFELoadConfig, MFELifecycle } from './interfaces';

/**
 * Module Federation Loader Implementation
 * Handles loading MFEs via Webpack Module Federation
 */
export class ModuleFederationLoader implements MFELoader {
  private loadedMFEs: Map<string, MFELifecycle> = new Map();
  private loadedScripts: Set<string> = new Set();

  async load(config: MFELoadConfig): Promise<MFELifecycle> {
    console.log(`[ModuleFederationLoader] Loading MFE: ${config.name}`);

    // Check if already loaded
    if (this.loadedMFEs.has(config.name)) {
      console.log(`[ModuleFederationLoader] MFE ${config.name} already loaded`);
      return this.loadedMFEs.get(config.name)!;
    }

    try {
      // Load remote entry script if not already loaded
      if (!this.loadedScripts.has(config.remoteUrl)) {
        await this.loadScript(config.remoteUrl);
        this.loadedScripts.add(config.remoteUrl);
      }

      // Get the remote container
      const scope = config.scope || config.name;
      const container = (window as any)[scope];

      if (!container) {
        throw new Error(
          `Container '${scope}' not found. Make sure the remote is properly configured.`
        );
      }

      // Initialize the container
      await container.init(__webpack_share_scopes__.default);

      // Get the module factory
      const factory = await container.get(config.module);
      const module = factory();

      // Validate that module exports the required lifecycle methods
      if (!module.mount || typeof module.mount !== 'function') {
        throw new Error(
          `MFE '${config.name}' does not export a mount() function`
        );
      }

      if (!module.unmount || typeof module.unmount !== 'function') {
        throw new Error(
          `MFE '${config.name}' does not export an unmount() function`
        );
      }

      const lifecycle: MFELifecycle = {
        mount: module.mount,
        unmount: module.unmount,
        update: module.update,
      };

      // Cache the loaded MFE
      this.loadedMFEs.set(config.name, lifecycle);

      console.log(`[ModuleFederationLoader] Successfully loaded MFE: ${config.name}`);
      return lifecycle;
    } catch (error) {
      console.error(`[ModuleFederationLoader] Failed to load MFE ${config.name}:`, error);
      throw error;
    }
  }

  isLoaded(mfeName: string): boolean {
    return this.loadedMFEs.has(mfeName);
  }

  async unload(mfeName: string): Promise<void> {
    this.loadedMFEs.delete(mfeName);
    console.log(`[ModuleFederationLoader] Unloaded MFE: ${mfeName}`);
  }

  /**
   * Load a remote script dynamically
   */
  private loadScript(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.type = 'text/javascript';
      script.async = true;

      script.onload = () => {
        console.log(`[ModuleFederationLoader] Loaded script: ${url}`);
        resolve();
      };

      script.onerror = () => {
        reject(new Error(`Failed to load script: ${url}`));
      };

      document.head.appendChild(script);
    });
  }
}

// Declare webpack share scopes for TypeScript
declare global {
  const __webpack_share_scopes__: any;
}
