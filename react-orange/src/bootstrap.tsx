import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// MFE Lifecycle implementation for React
// Note: Each mount creates instance-specific state stored in the returned MFEInstance

/**
 * Mount the React MFE
 * Conforms to MFELifecycle.mount() contract
 */
export async function mount(container: HTMLElement, context: any): Promise<any> {
  console.log('[React Orange Bootstrap] Mounting with context:', context);

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
  const root = ReactDOM.createRoot(container);
  root.render(
    <React.StrictMode>
      <App eventBus={context.eventBus} />
    </React.StrictMode>
  );

  // Return MFEInstance with instance-specific state
  return {
    _internal: { root, container },
    id: `react-orange-${Date.now()}`,
    mfeName: context.metadata?.mfeName || 'reactOrange',
    mountedAt: new Date(),
    isHealthy: () => root !== null
  };
}

/**
 * Unmount the React MFE
 * Conforms to MFELifecycle.unmount() contract
 */
export async function unmount(instance: any): Promise<void> {
  console.log('[React Orange Bootstrap] Unmounting - cleaning up DOM');

  const { root, container } = instance._internal;

  // Unmount React root
  if (root) {
    root.unmount();
  }

  // Clear the container
  if (container) {
    console.log('[React Orange Bootstrap] Clearing container');
    container.innerHTML = '';
    container.removeAttribute('data-mfe');
  }

  console.log('[React Orange Bootstrap] Cleanup complete');
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
