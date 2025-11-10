import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { MFETelemetry, telemetryRegistry } from '../../shared/mfe-core/src/telemetry';

// MFE Lifecycle implementation for React
// Note: Each mount creates instance-specific state stored in the returned MFEInstance

/**
 * Mount the React MFE
 * Conforms to MFELifecycle.mount() contract
 */
export async function mount(container: HTMLElement, context: any): Promise<any> {
  // Generate unique instance ID
  const instanceId = `react-orange-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const mfeName = context.metadata?.mfeName || 'reactOrange';

  // Get or create persistent telemetry for this MFE
  const globalRegistry = (window as any).__MFE_TELEMETRY__;
  const telemetry = globalRegistry
    ? globalRegistry.getOrCreatePersistentTelemetry(mfeName, instanceId)
    : new MFETelemetry(mfeName, instanceId);

  console.log('[React Orange Bootstrap] About to register telemetry:', {
    instanceId,
    mfeName,
    registryRef: telemetryRegistry,
    windowRegistry: (window as any).__MFE_TELEMETRY__,
    areTheSame: telemetryRegistry === (window as any).__MFE_TELEMETRY__
  });

  // ALWAYS use window.__MFE_TELEMETRY__ to avoid multiple registry instances
  if (globalRegistry) {
    globalRegistry.register(instanceId, telemetry);
  } else {
    console.error('[React Orange Bootstrap] window.__MFE_TELEMETRY__ not available!');
    // Fallback to imported registry
    telemetryRegistry.register(instanceId, telemetry);
  }

  telemetry.startMount();
  console.log('[React Orange Bootstrap] Mounting with context:', context);

  try {
    // Ensure container is completely clean before creating new root
    // React 18 requires a fresh container for createRoot after unmount
    container.innerHTML = '';

    // Remove any React internal markers from previous mounts
    Array.from(container.attributes).forEach(attr => {
      if (attr.name.startsWith('data-react')) {
        container.removeAttribute(attr.name);
      }
    });

    // Set a data attribute on container to identify this MFE
    container.setAttribute('data-mfe', 'react-orange');

    // Create React root
    // Note: StrictMode disabled for production-like memory profiling
    // StrictMode intentionally double-mounts components in development
    // which can cause false positives in memory leak detection
    const root = ReactDOM.createRoot(container);
    root.render(
      <App eventBus={context.eventBus} />
    );

    telemetry.endMount();

    // Return MFEInstance with instance-specific state
    const instance = {
      _internal: { root, container, telemetry },
      id: instanceId,
      mfeName: context.metadata?.mfeName || 'reactOrange',
      mountedAt: new Date(),
      isHealthy: () => {
        const health = telemetry.getHealthCheck();
        return root !== null && health.status !== 'critical';
      },
      getHealth: () => telemetry.getHealthCheck(),
      getTelemetry: () => telemetry.getSummary()
    };

    console.log('[React Orange Bootstrap] MFE Instance created with telemetry methods:', {
      id: instance.id,
      mfeName: instance.mfeName,
      hasGetHealth: typeof instance.getHealth === 'function',
      hasGetTelemetry: typeof instance.getTelemetry === 'function',
      hasIsHealthy: typeof instance.isHealthy === 'function',
      telemetrySummary: instance.getTelemetry()
    });

    return instance;
  } catch (error) {
    telemetry.recordError(error as Error, 'mount');
    console.error('[React Orange Bootstrap] Mount failed:', error);
    throw error;
  }
}

/**
 * Unmount the React MFE
 * Conforms to MFELifecycle.unmount() contract
 */
export async function unmount(instance: any): Promise<void> {
  const { root, container, telemetry } = instance._internal;

  telemetry.startUnmount();
  console.log('[React Orange Bootstrap] Unmounting - cleaning up DOM');

  try {
    // Unmount React root
    if (root) {
      root.unmount();
      // Wait for React to finish unmounting (important for React 18)
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    // Clear the container
    if (container) {
      console.log('[React Orange Bootstrap] Clearing container');
      container.innerHTML = '';
      container.removeAttribute('data-mfe');
    }

    // Clean up localStorage to prevent memory leaks during rapid mount/unmount cycles
    // This is critical for stress testing scenarios
    try {
      localStorage.removeItem('react-orange-receivedMessage');
      localStorage.removeItem('react-orange-lastMessageFrom');
      console.log('[React Orange Bootstrap] Cleared localStorage');
    } catch (error) {
      console.warn('[React Orange Bootstrap] Failed to clear localStorage:', error);
    }

    // Null out the reference to help garbage collection
    instance._internal.root = null;
    instance._internal.container = null;

    telemetry.endUnmount();

    // Unregister telemetry from global registry (use window global)
    const globalRegistry = (window as any).__MFE_TELEMETRY__;
    if (globalRegistry) {
      globalRegistry.unregister(instance.id);
    } else {
      console.warn('[React Orange Bootstrap] window.__MFE_TELEMETRY__ not available for unregister');
      telemetryRegistry.unregister(instance.id);
    }

    // Null out telemetry reference
    instance._internal.telemetry = null;

    console.log('[React Orange Bootstrap] Cleanup complete');
  } catch (error) {
    telemetry.recordError(error as Error, 'unmount');
    console.error('[React Orange Bootstrap] Unmount failed:', error);
    throw error;
  }
}

// For standalone development
if (process.env.NODE_ENV === 'development' && !window.location.pathname.includes('angular')) {
  const rootElement = document.getElementById('root');
  if (rootElement) {
    const devRoot = ReactDOM.createRoot(rootElement);
    devRoot.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  }
}
