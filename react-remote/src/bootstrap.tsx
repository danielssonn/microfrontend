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
  const instanceId = `react-pink-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Initialize telemetry for this instance
  const telemetry = new MFETelemetry(
    context.metadata?.mfeName || 'reactRemote',
    instanceId
  );
  telemetryRegistry.register(instanceId, telemetry);

  telemetry.startMount();
  console.log('[React Bootstrap] Mounting with context:', context);

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
  container.setAttribute('data-mfe', 'react-pink');

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
  return {
    _internal: { root, container, telemetry },
    id: instanceId,
    mfeName: context.metadata?.mfeName || 'reactRemote',
    mountedAt: new Date(),
    isHealthy: () => {
      const health = telemetry.getHealthCheck();
      return root !== null && health.status !== 'critical';
    },
    getHealth: () => telemetry.getHealthCheck(),
    getTelemetry: () => telemetry.getSummary()
  };
  } catch (error) {
    telemetry.recordError(error as Error, 'mount');
    console.error('[React Bootstrap] Mount failed:', error);
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
  console.log('[React Bootstrap] Unmounting - cleaning up DOM');

  try {

  // Unmount React root
  if (root) {
    root.unmount();
    // Wait for React to finish unmounting (important for React 18)
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  // Clear the container
  if (container) {
    console.log('[React Bootstrap] Clearing container');
    container.innerHTML = '';
    container.removeAttribute('data-mfe');
  }

  // Clean up localStorage to prevent memory leaks during rapid mount/unmount cycles
  // This is critical for stress testing scenarios
  try {
    localStorage.removeItem('react-pink-receivedMessage');
    localStorage.removeItem('react-pink-lastMessageFrom');
    console.log('[React Bootstrap] Cleared localStorage');
  } catch (error) {
    console.warn('[React Bootstrap] Failed to clear localStorage:', error);
  }

  // Null out the reference to help garbage collection
  instance._internal.root = null;
  instance._internal.container = null;

  telemetry.endUnmount();

  // Unregister telemetry from global registry
  telemetryRegistry.unregister(instance.id);

  // Null out telemetry reference
  instance._internal.telemetry = null;

  console.log('[React Bootstrap] Cleanup complete');
  } catch (error) {
    telemetry.recordError(error as Error, 'unmount');
    console.error('[React Bootstrap] Unmount failed:', error);
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
