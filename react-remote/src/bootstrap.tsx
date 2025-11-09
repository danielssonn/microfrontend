import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

let root: ReactDOM.Root | null = null;

export function mount(container: HTMLElement, props: any) {
  console.log('[React Bootstrap] Mounting with props:', props);
  root = ReactDOM.createRoot(container);
  root.render(
    <React.StrictMode>
      <App eventBus={props.eventBus} />
    </React.StrictMode>
  );
}

export function unmount(container: HTMLElement) {
  console.log('[React Bootstrap] Unmounting');
  if (root) {
    root.unmount();
    root = null;
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
