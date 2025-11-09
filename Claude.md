# Micro Frontend Scaffold Guide
## Based on Enterprise MFE Architecture & Abstraction Strategy

**Version**: 1.0
**Last Updated**: November 2025
**Purpose**: Scaffold template for creating new micro frontends following established architecture patterns

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Project Structure](#project-structure)
3. [**Common Pitfalls & How to Avoid Them**](#common-pitfalls--how-to-avoid-them)
4. [Implementation Guide](#implementation-guide)
5. [Integration Patterns](#integration-patterns)
6. [Testing Strategy](#testing-strategy)
7. [Deployment Guide](#deployment-guide)
8. [Monitoring & Observability](#monitoring--observability)
9. [Checklist](#checklist)

---

## Quick Start

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- Access to shared platform services (authentication, event bus, monitoring)
- CDN deployment credentials
- MFE registry access

### Create New MFE

```bash
# Clone MFE starter template
git clone <mfe-template-repo> mfe-<domain-name>
cd mfe-<domain-name>

# Install dependencies
npm install

# Configure MFE metadata
npm run configure

# Start development
npm run dev
```

---

## Project Structure

```
mfe-<domain-name>/
├── src/
│   ├── adapters/              # Framework adapters
│   │   ├── ReactAdapter.ts    # React-specific lifecycle
│   │   └── AngularAdapter.ts  # Angular-specific lifecycle
│   ├── components/            # UI components
│   │   ├── ErrorBoundary.tsx
│   │   ├── LoadingFallback.tsx
│   │   └── <domain>/          # Domain-specific components
│   ├── services/              # Business logic
│   │   ├── api/               # Backend integration
│   │   ├── events/            # Event bus integration
│   │   └── state/             # State management
│   ├── types/                 # TypeScript definitions
│   │   ├── lifecycle.ts       # MFE lifecycle contracts
│   │   ├── context.ts         # MFE context types
│   │   └── events.ts          # Event schemas
│   ├── bootstrap.ts           # MFE initialization
│   ├── lifecycle.ts           # Lifecycle implementation
│   └── index.ts               # Entry point
├── config/
│   ├── webpack.config.js      # Module Federation config
│   ├── rspack.config.js       # Alternative: Rspack config
│   └── vite.config.js         # Alternative: Vite config
├── tests/
│   ├── unit/                  # Unit tests
│   ├── integration/           # Integration tests
│   ├── contract/              # Contract tests
│   └── e2e/                   # End-to-end tests
├── .github/
│   └── workflows/
│       ├── ci.yml             # CI pipeline
│       └── deploy.yml         # Deployment pipeline
├── docs/
│   ├── ADRs/                  # Architecture Decision Records
│   ├── API.md                 # API documentation
│   └── EVENTS.md              # Event contracts
├── mfe.config.json            # MFE metadata
├── package.json
└── README.md
```

---

## Common Pitfalls & How to Avoid Them

⚠️ **CRITICAL**: These pitfalls are based on real production issues. Every new MFE MUST follow these patterns to avoid catastrophic failures.

### Pitfall 1: webpack style-loader CSS Module Caching ⚠️ CRITICAL

**Problem**: webpack's style-loader caches CSS modules globally, NOT per-mount. When switching between MFEs:
- First MFE's CSS is injected into `<style>` tags in `<head>`
- webpack caches the CSS module
- Second MFE's CSS is injected
- When switching back to first MFE, webpack DOES NOT re-inject its CSS (cached!)
- Result: Second MFE's styles persist because first MFE's styles are never re-applied

**Incorrect Approach** (will fail):
```typescript
// ❌ DON'T DO THIS - Tracking style tags doesn't work
export async function mount(container: HTMLElement, context: any) {
  const existingStyles = Array.from(document.head.querySelectorAll('style'));
  const existingStyleCount = existingStyles.length;

  const root = ReactDOM.createRoot(container);
  root.render(<App />);

  // Capture new styles
  await new Promise(resolve => setTimeout(resolve, 100));
  const allStyles = Array.from(document.head.querySelectorAll('style'));
  const styleElements = allStyles.slice(existingStyleCount);

  return { _internal: { root, styleElements } };
}

export async function unmount(instance: any) {
  // ❌ This removes styles, but they won't be re-injected on next mount!
  instance._internal.styleElements.forEach(el => el.remove());
}
```

**Why tracking fails:**
```
Mount Pink   → webpack injects Pink CSS (1st time)
Mount Orange → webpack injects Orange CSS (1st time)
Unmount Orange → Remove Orange styles ✓
Mount Pink   → webpack says "already loaded" → NO new injection ❌
Result: Orange styles gone, Pink styles gone → broken UI
```

**✅ CORRECT Approach** - CSS Attribute Scoping:

```typescript
// bootstrap.tsx
export async function mount(container: HTMLElement, context: any): Promise<any> {
  // Set unique data attribute for this MFE
  container.setAttribute('data-mfe', 'payment-mfe');  // Use your MFE name

  const root = ReactDOM.createRoot(container);
  root.render(<App eventBus={context.eventBus} />);

  return {
    _internal: { root, container },
    id: `payment-${Date.now()}`,
    mfeName: context.metadata?.mfeName || 'payments',
    mountedAt: new Date(),
    isHealthy: () => root !== null
  };
}

export async function unmount(instance: any): Promise<void> {
  const { root, container } = instance._internal;

  if (root) {
    root.unmount();
  }

  if (container) {
    container.innerHTML = '';
    container.removeAttribute('data-mfe');  // Clean up attribute
  }
}
```

```css
/* App.css - Scope ALL selectors with data attribute */
[data-mfe="payment-mfe"] .button {
  background: blue;
}

[data-mfe="payment-mfe"] .card {
  border: 1px solid gray;
}

[data-mfe="payment-mfe"] h1 {
  color: darkblue;
}

/* ❌ DON'T write unscoped selectors */
/* .button { background: blue; }  ← This will leak to other MFEs! */
```

**How it works:**
- Both MFE CSS files remain loaded in DOM (webpack caches them)
- Data attribute on container controls which styles apply
- When switching MFEs, changing the attribute automatically switches which CSS rules match
- No DOM manipulation needed - pure CSS specificity

**Testing:**
```bash
# Test MFE switching multiple times
1. Load Payment MFE → should see blue theme
2. Load Account MFE → should see green theme
3. Load Payment MFE again → should see blue theme (NOT green!)
4. Repeat 10 times → colors should switch correctly every time
```

---

### Pitfall 2: GlobalEventBus Subscription Accumulation ⚠️ CRITICAL

**Problem**: Event bus singletons accumulate subscriptions from unmounted MFEs.

**Incorrect Approach**:
```typescript
// ❌ DON'T DO THIS
export async function mount(container: HTMLElement, context: any) {
  const root = ReactDOM.createRoot(container);

  // Subscribe to events
  context.eventBus.subscribe('PaymentCompleted', (payload) => {
    console.log('Payment completed:', payload);
  });

  root.render(<App />);
  return { _internal: { root } };
}

// ❌ Unmount doesn't clean up subscriptions!
export async function unmount(instance: any) {
  instance._internal.root.unmount();
}

// Result: After 10 mount/unmount cycles, the same event fires 10 handlers!
```

**✅ CORRECT Approach**:
```typescript
export async function mount(container: HTMLElement, context: any): Promise<any> {
  container.setAttribute('data-mfe', 'payment-mfe');

  const root = ReactDOM.createRoot(container);

  // Store unsubscribe functions
  const subscriptions: Array<() => void> = [];

  // Subscribe and store cleanup function
  const unsubPayment = context.eventBus.subscribe('PaymentCompleted', (payload) => {
    console.log('Payment completed:', payload);
  });
  subscriptions.push(unsubPayment);

  const unsubAccount = context.eventBus.subscribe('AccountUpdated', (payload) => {
    console.log('Account updated:', payload);
  });
  subscriptions.push(unsubAccount);

  root.render(
    <React.StrictMode>
      <App eventBus={context.eventBus} />
    </React.StrictMode>
  );

  return {
    _internal: { root, container, subscriptions },  // Store subscriptions!
    id: `payment-${Date.now()}`,
    mfeName: context.metadata?.mfeName || 'payments',
    mountedAt: new Date(),
    isHealthy: () => root !== null
  };
}

export async function unmount(instance: any): Promise<void> {
  const { root, container, subscriptions } = instance._internal;

  // Unmount React
  if (root) {
    root.unmount();
  }

  // ✅ Clean up ALL subscriptions
  if (subscriptions && Array.isArray(subscriptions)) {
    subscriptions.forEach(unsub => {
      if (typeof unsub === 'function') {
        unsub();
      }
    });
  }

  // Clear container
  if (container) {
    container.innerHTML = '';
    container.removeAttribute('data-mfe');
  }

  console.log('[Payment MFE] Cleanup complete - subscriptions removed');
}
```

**Testing:**
```typescript
// Test subscription cleanup
test('Event subscriptions cleaned up on unmount', async () => {
  let handlerCallCount = 0;

  for (let i = 0; i < 10; i++) {
    const instance = await mount(container, context);
    await unmount(instance);
  }

  // Publish event
  eventBus.publish('PaymentCompleted', { id: '123' });

  // Should NOT fire any handlers (all cleaned up)
  expect(handlerCallCount).toBe(0);
});
```

---

### Pitfall 3: Module Federation Loader Cache Never Invalidates ⚠️ HIGH

**Problem**: ModuleFederationLoader caches lifecycle modules and scripts indefinitely.

**Incorrect Approach**:
```typescript
// ❌ DON'T DO THIS
export class ModuleFederationLoader implements MFELoader {
  private loadedMFEs: Map<string, MFELifecycle> = new Map();
  private loadedScripts: Set<string> = new Set();

  async load(config: MFELoadConfig): Promise<MFELifecycle> {
    // Returns cached version forever
    if (this.loadedMFEs.has(config.name)) {
      return this.loadedMFEs.get(config.name)!;
    }

    // Load and cache
    const lifecycle = await this.loadModule(config);
    this.loadedMFEs.set(config.name, lifecycle);  // ❌ Never cleared!
    return lifecycle;
  }
}
```

**✅ CORRECT Approach**:
```typescript
export class ModuleFederationLoader implements MFELoader {
  private loadedMFEs: Map<string, MFELifecycle> = new Map();
  private loadedScripts: Set<string> = new Set();
  private scriptElements: Map<string, HTMLScriptElement> = new Map();

  async load(config: MFELoadConfig): Promise<MFELifecycle> {
    // Check if already loaded
    if (this.loadedMFEs.has(config.name)) {
      console.log(`[Loader] MFE ${config.name} already loaded, returning cached`);
      return this.loadedMFEs.get(config.name)!;
    }

    const lifecycle = await this.loadModule(config);
    this.loadedMFEs.set(config.name, lifecycle);
    return lifecycle;
  }

  async unload(mfeName: string): Promise<void> {
    console.log(`[Loader] Unloading MFE: ${mfeName}`);

    // Remove from cache
    this.loadedMFEs.delete(mfeName);

    // Optional: Remove script element (be careful with shared dependencies!)
    const scriptElement = this.scriptElements.get(mfeName);
    if (scriptElement && scriptElement.parentNode) {
      scriptElement.parentNode.removeChild(scriptElement);
    }
    this.scriptElements.delete(mfeName);

    console.log(`[Loader] MFE ${mfeName} unloaded from cache`);
  }

  clearCache(): void {
    console.log('[Loader] Clearing all cached MFEs');
    this.loadedMFEs.clear();

    // Remove all script elements
    this.scriptElements.forEach((script, mfeName) => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    });
    this.scriptElements.clear();
    this.loadedScripts.clear();
  }
}
```

---

### Pitfall 4: Angular Service State Pollution Across MFE Switches ⚠️ MEDIUM

**Problem**: Angular singleton services (`providedIn: 'root'`) maintain state across MFE mount/unmount cycles.

**Incorrect Approach**:
```typescript
// ❌ DON'T DO THIS
@Injectable({ providedIn: 'root' })
export class MFELoaderService {
  private loadedInstances: Map<string, MFEInstance> = new Map();

  async loadMFE(config: MFELoadConfig, container: HTMLElement): Promise<MFEInstance> {
    const instance = await this.loader.mount(container, context);
    this.loadedInstances.set(config.name, instance);  // ❌ Never cleared!
    return instance;
  }
}

// After loading Pink → Orange → Pink:
// loadedInstances has: { 'pink': <old instance>, 'orange': <instance> }
// Old pink instance is leaked!
```

**✅ CORRECT Approach**:
```typescript
@Injectable({ providedIn: 'root' })
export class MFELoaderService {
  private loadedInstances: Map<string, MFEInstance> = new Map();

  async loadMFE(config: MFELoadConfig, container: HTMLElement): Promise<MFEInstance> {
    const instance = await this.loader.mount(container, context);
    this.loadedInstances.set(config.name, instance);
    return instance;
  }

  async unloadMFE(mfeName: string): Promise<void> {
    const instance = this.loadedInstances.get(mfeName);
    if (!instance) {
      console.warn(`[MFELoader] No instance found for ${mfeName}`);
      return;
    }

    // Unmount via lifecycle
    await this.loader.unmount(instance);

    // ✅ Remove from instance map
    this.loadedInstances.delete(mfeName);

    console.log(`[MFELoader] ${mfeName} unloaded and removed from cache`);
  }

  clearAll(): void {
    console.log('[MFELoader] Clearing all loaded instances');

    // Unmount all instances
    const promises = Array.from(this.loadedInstances.keys()).map(name =>
      this.unloadMFE(name)
    );

    return Promise.all(promises).then(() => {
      this.loadedInstances.clear();
    });
  }
}
```

---

### Pitfall 5: document.head Script Tag Accumulation ⚠️ HIGH

**Problem**: remoteEntry.js scripts appended to `document.head` but never removed.

**✅ CORRECT Approach**:
```typescript
export class ModuleFederationLoader implements MFELoader {
  private scriptElements: Map<string, HTMLScriptElement> = new Map();

  private loadScript(url: string, mfeName: string): Promise<void> {
    // Check if already loaded
    if (this.scriptElements.has(mfeName)) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.type = 'text/javascript';
      script.async = true;

      script.onload = () => {
        this.scriptElements.set(mfeName, script);  // Track it!
        resolve();
      };

      script.onerror = () => {
        reject(new Error(`Failed to load script: ${url}`));
      };

      document.head.appendChild(script);
    });
  }

  async unload(mfeName: string): Promise<void> {
    // Remove script element
    const scriptElement = this.scriptElements.get(mfeName);
    if (scriptElement?.parentNode) {
      scriptElement.parentNode.removeChild(scriptElement);
      console.log(`[Loader] Removed script for ${mfeName}`);
    }
    this.scriptElements.delete(mfeName);
  }
}
```

---

### Summary: Must-Follow Patterns

| Pitfall | Solution | Priority |
|---------|----------|----------|
| **CSS caching** | Use `[data-mfe="name"]` attribute scoping | CRITICAL |
| **Event subscriptions** | Store unsubscribe functions, call in unmount | CRITICAL |
| **Loader cache** | Implement unload() to clear cached modules | HIGH |
| **Service state** | Clear instance maps in unload methods | MEDIUM |
| **Script accumulation** | Track script elements, remove in unload | HIGH |

---

## Implementation Guide

### Step 1: Define MFE Metadata

Create or update `mfe.config.json`:

```json
{
  "name": "payments",
  "version": "1.0.0",
  "framework": "react",
  "frameworkVersion": "18.2.0",
  "bundler": "rspack",
  "owner": {
    "team": "Payments Business Unit",
    "contact": "payments-team@company.com",
    "slack": "#team-payments"
  },
  "domain": {
    "basePath": "/payments",
    "routes": [
      "/payments/list",
      "/payments/create",
      "/payments/:id"
    ]
  },
  "dependencies": {
    "shared": {
      "react": {
        "singleton": true,
        "requiredVersion": "^18.2.0"
      },
      "react-dom": {
        "singleton": true,
        "requiredVersion": "^18.2.0"
      },
      "@company/design-system": {
        "singleton": true,
        "requiredVersion": "^2.0.0"
      },
      "@company/auth-client": {
        "singleton": true,
        "requiredVersion": "^1.0.0"
      }
    }
  },
  "exposes": {
    "./Lifecycle": "./src/lifecycle.ts"
  },
  "monitoring": {
    "serviceName": "mfe-payments",
    "telemetryEndpoint": "https://telemetry.company.com"
  }
}
```

### Step 2: Implement MFE Lifecycle Contract

#### For React MFEs

Create `src/lifecycle.ts`:

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { MFELifecycle, MFEContext, MFEInstance } from './types/lifecycle';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MFEContextProvider } from './providers/MFEContextProvider';
import RootComponent from './components/RootComponent';
import { initializeMonitoring } from './services/monitoring';
import { initializeEventBus } from './services/events';

export class ReactMFEAdapter implements MFELifecycle {
  private root: ReactDOM.Root | null = null;
  private cleanupFunctions: Array<() => void> = [];
  private eventBusCleanup: (() => void) | null = null;

  async mount(container: HTMLElement, context: MFEContext): Promise<MFEInstance> {
    try {
      // Initialize monitoring
      const monitoring = initializeMonitoring(context);
      this.cleanupFunctions.push(() => monitoring.shutdown());

      // Initialize event bus
      this.eventBusCleanup = initializeEventBus(context.eventBus);

      // Create React root
      this.root = ReactDOM.createRoot(container);

      // Render application
      this.root.render(
        <React.StrictMode>
          <MFEContextProvider value={context}>
            <ErrorBoundary
              mfeName={context.metadata.mfeName}
              onError={(error) => monitoring.captureError(error)}
            >
              <RootComponent />
            </ErrorBoundary>
          </MFEContextProvider>
        </React.StrictMode>
      );

      monitoring.trackEvent('mfe_mounted', {
        mfeName: context.metadata.mfeName,
        version: context.metadata.version
      });

      return {
        _internal: this.root,
        id: `${context.metadata.mfeName}-${Date.now()}`,
        mfeName: context.metadata.mfeName,
        mountedAt: new Date(),
        isHealthy: () => this.root !== null
      };
    } catch (error) {
      console.error(`[${context.metadata.mfeName}] Mount failed:`, error);
      throw error;
    }
  }

  async unmount(instance: MFEInstance): Promise<void> {
    try {
      // Unmount React
      if (this.root) {
        this.root.unmount();
        this.root = null;
      }

      // Cleanup event bus subscriptions
      if (this.eventBusCleanup) {
        this.eventBusCleanup();
        this.eventBusCleanup = null;
      }

      // Run all cleanup functions
      this.cleanupFunctions.forEach(cleanup => cleanup());
      this.cleanupFunctions = [];

      // Verify no memory leaks
      if (typeof window !== 'undefined' && window.performance?.memory) {
        console.log(`[${instance.mfeName}] Memory after unmount:`,
          window.performance.memory.usedJSHeapSize
        );
      }
    } catch (error) {
      console.error(`[${instance.mfeName}] Unmount failed:`, error);
      throw error;
    }
  }

  async update(instance: MFEInstance, context: Partial<MFEContext>): Promise<void> {
    // Optional: Implement if hot updates needed
    console.log(`[${instance.mfeName}] Update called with context:`, context);
  }
}

// Export singleton instance
export const lifecycle = new ReactMFEAdapter();
```

#### For Angular MFEs

Create `src/lifecycle.ts`:

```typescript
import { platformBrowserDynamic, PlatformRef } from '@angular/platform-browser-dynamic';
import { NgModuleRef, Type } from '@angular/core';
import { MFELifecycle, MFEContext, MFEInstance } from './types/lifecycle';
import { MFE_CONTEXT } from './tokens/mfe-context.token';
import { AppModule } from './app/app.module';

export class AngularMFEAdapter implements MFELifecycle {
  private moduleRef: NgModuleRef<any> | null = null;
  private platformRef: PlatformRef | null = null;

  async mount(container: HTMLElement, context: MFEContext): Promise<MFEInstance> {
    try {
      // Create app root element
      const appRoot = document.createElement('app-root');
      appRoot.setAttribute('data-mfe', context.metadata.mfeName);
      container.appendChild(appRoot);

      // Bootstrap Angular with context injection
      this.platformRef = platformBrowserDynamic([
        { provide: MFE_CONTEXT, useValue: context }
      ]);

      this.moduleRef = await this.platformRef.bootstrapModule(AppModule, {
        ngZone: 'zone.js' // Ensure Zone.js isolation
      });

      return {
        _internal: {
          moduleRef: this.moduleRef,
          platformRef: this.platformRef,
          appRoot
        },
        id: `${context.metadata.mfeName}-${Date.now()}`,
        mfeName: context.metadata.mfeName,
        mountedAt: new Date(),
        isHealthy: () => this.moduleRef !== null && !this.moduleRef.destroyed
      };
    } catch (error) {
      console.error(`[${context.metadata.mfeName}] Mount failed:`, error);
      throw error;
    }
  }

  async unmount(instance: MFEInstance): Promise<void> {
    try {
      // Destroy Angular module
      if (this.moduleRef && !this.moduleRef.destroyed) {
        this.moduleRef.destroy();
        this.moduleRef = null;
      }

      // Destroy platform
      if (this.platformRef && !this.platformRef.destroyed) {
        this.platformRef.destroy();
        this.platformRef = null;
      }

      // Remove DOM elements
      const internal = instance._internal as any;
      if (internal?.appRoot?.parentNode) {
        internal.appRoot.parentNode.removeChild(internal.appRoot);
      }

      console.log(`[${instance.mfeName}] Cleanup completed`);
    } catch (error) {
      console.error(`[${instance.mfeName}] Unmount failed:`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const lifecycle = new AngularMFEAdapter();
```

### Step 3: Implement MFE Context Provider

Create `src/providers/MFEContextProvider.tsx` (React example):

```typescript
import React, { createContext, useContext, ReactNode } from 'react';
import { MFEContext } from '../types/lifecycle';

const MFEContextContext = createContext<MFEContext | null>(null);

export const MFEContextProvider: React.FC<{
  value: MFEContext;
  children: ReactNode
}> = ({ value, children }) => {
  return (
    <MFEContextContext.Provider value={value}>
      {children}
    </MFEContextContext.Provider>
  );
};

export const useMFEContext = (): MFEContext => {
  const context = useContext(MFEContextContext);
  if (!context) {
    throw new Error('useMFEContext must be used within MFEContextProvider');
  }
  return context;
};

// Convenience hooks
export const useAuth = () => useMFEContext().auth;
export const useRouting = () => useMFEContext().routing;
export const useEventBus = () => useMFEContext().eventBus;
export const useConfig = () => useMFEContext().config;
```

### Step 4: Implement Error Boundary

Create `src/components/ErrorBoundary.tsx`:

```typescript
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  mfeName: string;
  children: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(`[${this.props.mfeName}] Error caught:`, error, errorInfo);

    // Report to monitoring
    this.props.onError?.(error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="mfe-error-boundary">
          <h2>Something went wrong in {this.props.mfeName}</h2>
          <details>
            <summary>Error details</summary>
            <pre>{this.state.error?.message}</pre>
            <pre>{this.state.error?.stack}</pre>
          </details>
          <button onClick={() => this.setState({ hasError: false, error: null })}>
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### Step 5: Configure Module Federation

#### Using Webpack 5

Create `config/webpack.config.js`:

```javascript
const { ModuleFederationPlugin } = require('webpack').container;
const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');
const mfeConfig = require('../mfe.config.json');

module.exports = {
  entry: './src/index.ts',
  mode: 'production',
  output: {
    path: path.resolve(__dirname, '../dist'),
    filename: '[name].[contenthash].js',
    publicPath: 'auto',
    clean: true
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx']
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  plugins: [
    new ModuleFederationPlugin({
      name: mfeConfig.name,
      filename: 'remoteEntry.js',
      exposes: mfeConfig.exposes,
      shared: {
        ...Object.entries(mfeConfig.dependencies.shared).reduce(
          (acc, [pkg, config]) => ({
            ...acc,
            [pkg]: config
          }),
          {}
        )
      }
    }),
    new HtmlWebpackPlugin({
      template: './public/index.html'
    })
  ]
};
```

#### Using Rspack (Alternative)

Create `config/rspack.config.js`:

```javascript
const { ModuleFederationPlugin } = require('@rspack/core').container;
const mfeConfig = require('../mfe.config.json');

module.exports = {
  entry: './src/index.ts',
  mode: 'production',
  output: {
    filename: '[name].[contenthash].js',
    publicPath: 'auto'
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx']
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        use: 'builtin:swc-loader',
        options: {
          jsc: {
            parser: { syntax: 'typescript', tsx: true }
          }
        }
      }
    ]
  },
  plugins: [
    new ModuleFederationPlugin({
      name: mfeConfig.name,
      filename: 'remoteEntry.js',
      exposes: mfeConfig.exposes,
      shared: mfeConfig.dependencies.shared
    })
  ]
};
```

### Step 6: Implement Event Bus Integration

Create `src/services/events/index.ts`:

```typescript
import { IsolatedEventBus, EventHandler } from '../../types/events';

export function initializeEventBus(eventBus: IsolatedEventBus): () => void {
  const subscriptions = new Map<string, EventHandler[]>();

  // Subscribe to relevant events
  const unsubscribePaymentCompleted = eventBus.subscribe(
    'PaymentCompleted',
    (payload) => {
      console.log('Payment completed:', payload);
      // Handle event
    }
  );

  const unsubscribeAccountCreated = eventBus.subscribe(
    'AccountCreated',
    (payload) => {
      console.log('Account created:', payload);
      // Handle event
    }
  );

  // Return cleanup function
  return () => {
    unsubscribePaymentCompleted();
    unsubscribeAccountCreated();
    subscriptions.clear();
  };
}

// Publish event helper
export function publishEvent(
  eventBus: IsolatedEventBus,
  eventName: string,
  payload: any
): void {
  try {
    eventBus.publish(eventName, payload);
    console.log(`Event published: ${eventName}`, payload);
  } catch (error) {
    console.error(`Failed to publish event: ${eventName}`, error);
  }
}
```

Define event schemas in `docs/EVENTS.md`:

```markdown
# Event Contracts

## PaymentCompleted

**Publisher**: Payments MFE
**Subscribers**: Accounts MFE, Analytics MFE, Notifications MFE

**Payload Schema**:
```typescript
{
  paymentId: string;
  amount: number;
  currency: 'USD' | 'EUR' | 'GBP';
  status: 'completed' | 'pending' | 'failed';
  timestamp: string; // ISO 8601
  userId: string;
  metadata?: Record<string, any>;
}
```

**Example**:
```json
{
  "paymentId": "pay_1234567890",
  "amount": 1500.00,
  "currency": "USD",
  "status": "completed",
  "timestamp": "2025-11-09T10:30:00Z",
  "userId": "usr_abc123"
}
```
```

### Step 7: Implement Monitoring

Create `src/services/monitoring/index.ts`:

```typescript
import { trace, metrics, context } from '@opentelemetry/api';
import { MFEContext } from '../../types/lifecycle';

export function initializeMonitoring(mfeContext: MFEContext) {
  const tracer = trace.getTracer(mfeContext.metadata.mfeName);
  const meter = metrics.getMeter(mfeContext.metadata.mfeName);

  // Create metrics
  const mountCounter = meter.createCounter('mfe.mounted.count');
  const errorCounter = meter.createCounter('mfe.errors.count');
  const loadHistogram = meter.createHistogram('mfe.load.duration');

  return {
    trackEvent(name: string, attributes?: Record<string, any>) {
      const span = tracer.startSpan(name);
      span.setAttributes({
        'mfe.name': mfeContext.metadata.mfeName,
        'mfe.version': mfeContext.metadata.version,
        ...attributes
      });
      span.end();
    },

    trackError(error: Error, attributes?: Record<string, any>) {
      errorCounter.add(1, {
        'mfe.name': mfeContext.metadata.mfeName,
        'error.type': error.name,
        ...attributes
      });
      console.error(`[${mfeContext.metadata.mfeName}] Error:`, error);
    },

    captureError(error: Error) {
      this.trackError(error);
    },

    recordMetric(name: string, value: number, attributes?: Record<string, any>) {
      const counter = meter.createCounter(name);
      counter.add(value, {
        'mfe.name': mfeContext.metadata.mfeName,
        ...attributes
      });
    },

    shutdown() {
      // Cleanup monitoring resources
      console.log(`[${mfeContext.metadata.mfeName}] Monitoring shutdown`);
    }
  };
}
```

---

## Integration Patterns

### Pattern 1: Shell Integration (Route-Based)

Shell loads MFE when route is accessed:

```typescript
// In shell application
import { lifecycleManager } from '@company/mfe-platform';

async function loadMFE(route: string) {
  const mfeConfig = await registry.getMFEForRoute(route);
  const container = document.getElementById('mfe-container');

  await lifecycleManager.mount(
    mfeConfig.name,
    container,
    {
      auth: getAuthContext(),
      routing: getRoutingContext(),
      eventBus: getEventBus(),
      config: getConfig(),
      metadata: mfeConfig.metadata
    }
  );
}
```

### Pattern 2: Legacy App Integration

Inject MFE into existing monolith:

```typescript
// In legacy application
<div id="payments-placeholder"></div>

<script>
  const container = document.getElementById('payments-placeholder');

  // Load MFE adapter
  import('@company/mfe-platform').then(async ({ lifecycleManager }) => {
    await lifecycleManager.mount('payments', container, contextFromLegacyApp);
  });
</script>
```

### Pattern 3: Slot-Based Composition

Multiple MFEs in dashboard:

```html
<div class="dashboard">
  <div id="mfe-slot-summary"></div>
  <div id="mfe-slot-activity"></div>
  <div id="mfe-slot-analytics"></div>
</div>
```

```typescript
await Promise.all([
  lifecycleManager.mount('summary', slot1, context),
  lifecycleManager.mount('activity', slot2, context),
  lifecycleManager.mount('analytics', slot3, context)
]);
```

---

## Testing Strategy

### Unit Tests

Create `tests/unit/lifecycle.test.ts`:

```typescript
import { lifecycle } from '../../src/lifecycle';
import { MFEContext } from '../../src/types/lifecycle';

describe('MFE Lifecycle', () => {
  let container: HTMLElement;
  let context: MFEContext;

  beforeEach(() => {
    container = document.createElement('div');
    context = createMockContext();
  });

  test('should mount successfully', async () => {
    const instance = await lifecycle.mount(container, context);

    expect(instance).toBeDefined();
    expect(instance.id).toBeDefined();
    expect(instance.isHealthy()).toBe(true);
  });

  test('should unmount cleanly', async () => {
    const instance = await lifecycle.mount(container, context);
    await lifecycle.unmount(instance);

    expect(container.innerHTML).toBe('');
  });

  test('should handle mount errors gracefully', async () => {
    const badContext = { ...context, auth: null };

    await expect(lifecycle.mount(container, badContext)).rejects.toThrow();
  });
});
```

### Contract Tests

Create `tests/contract/events.test.ts`:

```typescript
import { validateEventPayload } from '@company/mfe-testing';
import { PaymentCompletedSchema } from '../../src/types/events';

describe('Event Contracts', () => {
  test('PaymentCompleted event matches schema', () => {
    const payload = {
      paymentId: 'pay_123',
      amount: 100.00,
      currency: 'USD',
      status: 'completed',
      timestamp: new Date().toISOString(),
      userId: 'usr_456'
    };

    expect(validateEventPayload(payload, PaymentCompletedSchema)).toBe(true);
  });

  test('PaymentCompleted with invalid currency fails validation', () => {
    const payload = {
      paymentId: 'pay_123',
      amount: 100.00,
      currency: 'XXX', // Invalid
      status: 'completed',
      timestamp: new Date().toISOString(),
      userId: 'usr_456'
    };

    expect(validateEventPayload(payload, PaymentCompletedSchema)).toBe(false);
  });
});
```

### Integration Tests

Create `tests/integration/cross-mfe.test.ts`:

```typescript
import { lifecycleManager } from '@company/mfe-platform';
import { createTestEventBus } from '@company/mfe-testing';

describe('Cross-MFE Communication', () => {
  test('Payments MFE can send event to Accounts MFE', async () => {
    const eventBus = createTestEventBus();
    const context = { ...baseContext, eventBus };

    const container1 = document.createElement('div');
    const container2 = document.createElement('div');

    // Mount both MFEs
    await lifecycleManager.mount('payments', container1, context);
    await lifecycleManager.mount('accounts', container2, context);

    // Listen for event
    const eventPromise = new Promise((resolve) => {
      eventBus.subscribe('PaymentCompleted', resolve);
    });

    // Trigger payment
    container1.querySelector('[data-testid="pay-button"]')?.click();

    // Verify event received
    const payload = await eventPromise;
    expect(payload).toMatchObject({
      paymentId: expect.any(String),
      amount: expect.any(Number)
    });
  });
});
```

### Memory Leak Tests

Create `tests/integration/memory.test.ts`:

```typescript
describe('Memory Leak Detection', () => {
  test('MFE should not leak memory on mount/unmount cycle', async () => {
    const iterations = 10;

    if (global.gc) global.gc();
    const initialMemory = performance.memory?.usedJSHeapSize || 0;

    for (let i = 0; i < iterations; i++) {
      const container = document.createElement('div');
      const instance = await lifecycle.mount(container, context);
      await lifecycle.unmount(instance);
      if (global.gc) global.gc();
    }

    const finalMemory = performance.memory?.usedJSHeapSize || 0;
    const memoryGrowth = finalMemory - initialMemory;
    const allowedGrowth = 5 * 1024 * 1024; // 5MB

    expect(memoryGrowth).toBeLessThan(allowedGrowth);
  });
});
```

---

## Deployment Guide

### CI/CD Pipeline

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy MFE

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Run contract tests
        run: npm run test:contract

      - name: Build MFE
        run: npm run build

      - name: Generate version
        id: version
        run: echo "VERSION=$(date +%Y%m%d%H%M%S)-$(git rev-parse --short HEAD)" >> $GITHUB_OUTPUT

      - name: Upload to CDN
        run: |
          aws s3 sync dist/ s3://${{ secrets.CDN_BUCKET }}/${{ github.event.repository.name }}/${{ steps.version.outputs.VERSION }}/ \
            --cache-control "public, max-age=31536000, immutable"

      - name: Update MFE Registry
        run: |
          curl -X POST ${{ secrets.MFE_REGISTRY_URL }}/register \
            -H "Content-Type: application/json" \
            -d '{
              "name": "${{ github.event.repository.name }}",
              "version": "${{ steps.version.outputs.VERSION }}",
              "url": "https://${{ secrets.CDN_DOMAIN }}/${{ github.event.repository.name }}/${{ steps.version.outputs.VERSION }}/remoteEntry.js",
              "metadata": {
                "commit": "${{ github.sha }}",
                "author": "${{ github.actor }}",
                "timestamp": "${{ github.event.head_commit.timestamp }}"
              }
            }'

      - name: Progressive Rollout
        run: |
          # 5% traffic
          npm run deploy:canary -- --percentage 5
          sleep 300

          # Monitor metrics
          npm run check:metrics

          # 25% traffic
          npm run deploy:canary -- --percentage 25
          sleep 300

          # 100% traffic
          npm run deploy:production
```

### Deployment Commands

Add to `package.json`:

```json
{
  "scripts": {
    "build": "webpack --config config/webpack.config.js",
    "build:rspack": "rspack build --config config/rspack.config.js",
    "deploy:canary": "node scripts/deploy-canary.js",
    "deploy:production": "node scripts/deploy-production.js",
    "check:metrics": "node scripts/check-metrics.js",
    "rollback": "node scripts/rollback.js"
  }
}
```

---

## Monitoring & Observability

### Key Metrics to Track

1. **Load Metrics**
   - `mfe.load.duration` - Time to load MFE bundle
   - `mfe.load.failures` - Failed load attempts
   - `mfe.load.size` - Bundle size

2. **Runtime Metrics**
   - `mfe.mounted.count` - Number of active instances
   - `mfe.healthy` - Health status (0 or 1)
   - `mfe.uptime` - Time since mount

3. **Business Metrics**
   - `payment.completed.count` - Successful payments
   - `payment.failed.count` - Failed payments
   - `user.conversion.rate` - Business KPIs

### Monitoring Dashboard

Create Grafana dashboard with:

```json
{
  "dashboard": {
    "title": "MFE: Payments",
    "panels": [
      {
        "title": "Load Success Rate",
        "targets": [
          {
            "expr": "rate(mfe_load_success[5m]) / rate(mfe_load_total[5m])"
          }
        ]
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(mfe_errors_count[5m])"
          }
        ]
      },
      {
        "title": "Memory Usage",
        "targets": [
          {
            "expr": "mfe_memory_heap_bytes"
          }
        ]
      }
    ]
  }
}
```

### Alerting Rules

Create `monitoring/alerts.yml`:

```yaml
groups:
  - name: mfe_alerts
    rules:
      - alert: MFELoadFailureHigh
        expr: rate(mfe_load_failures[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "MFE {{ $labels.mfeName }} has high failure rate"

      - alert: MFEUnhealthy
        expr: mfe_healthy == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "MFE {{ $labels.mfeName }} is unhealthy"

      - alert: MFEMemoryLeak
        expr: rate(mfe_memory_heap_bytes[10m]) > 1048576
        for: 30m
        labels:
          severity: warning
        annotations:
          summary: "Potential memory leak in {{ $labels.mfeName }}"
```

---

## Checklist

### Before Development

- [ ] MFE name and domain defined
- [ ] Team ownership assigned
- [ ] Base path and routes documented
- [ ] Event contracts defined
- [ ] Shared dependencies identified
- [ ] Access to platform services obtained

### During Development

- [ ] Lifecycle contract implemented
- [ ] Error boundaries added
- [ ] Event bus integration complete
- [ ] Monitoring instrumentation added
- [ ] Unit tests written (>80% coverage)
- [ ] Contract tests implemented
- [ ] Integration tests added
- [ ] Memory leak tests passing
- [ ] Documentation updated

### Before Deployment

- [ ] CI/CD pipeline configured
- [ ] Security scan passed
- [ ] Performance budget met
- [ ] Accessibility audit passed
- [ ] Contract tests with dependent MFEs passing
- [ ] Monitoring dashboard created
- [ ] Alerting rules configured
- [ ] Rollback plan documented
- [ ] CDN deployment tested
- [ ] MFE registry integration verified

### After Deployment

- [ ] Canary deployment successful
- [ ] Metrics showing healthy status
- [ ] No errors in production logs
- [ ] Business metrics tracking correctly
- [ ] Team notified of deployment
- [ ] Documentation published
- [ ] Architecture Decision Records updated

---

## Additional Resources

### Internal Documentation

- [MFE Platform Documentation](https://docs.company.com/mfe-platform)
- [Shared Design System](https://docs.company.com/design-system)
- [Authentication Integration Guide](https://docs.company.com/auth-integration)
- [Event Catalog](https://docs.company.com/event-catalog)

### Architecture Decision Records

- [ADR-001: Why Module Federation](./docs/ADRs/001-module-federation.md)
- [ADR-002: Event-Driven Communication](./docs/ADRs/002-event-driven.md)
- [ADR-003: Monitoring Strategy](./docs/ADRs/003-monitoring.md)

### Team Contacts

- **Platform Team**: #team-platform (Slack)
- **Security Team**: security@company.com
- **Architecture Council**: #architecture (Slack)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | Nov 2025 | Initial scaffold template |

---

**Last Updated**: November 2025
**Owner**: Platform Architecture Team
**Review Cycle**: Quarterly
