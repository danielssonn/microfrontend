# Module Federation Fundamentals
## A Practical Walkthrough Using the Angular-React MFE Demo

**Version**: 1.0
**Last Updated**: November 2025
**Purpose**: Educational guide explaining how webpack Module Federation works in our micro frontend architecture

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Split: Build Time vs Runtime](#architecture-split-build-time-vs-runtime)
3. [Webpack Configurations](#webpack-configurations)
4. [The Complete Execution Flow](#the-complete-execution-flow)
5. [Key Concepts Illustrated](#key-concepts-illustrated)
6. [Visual Diagrams](#visual-diagrams)
7. [Code Examples from Our Codebase](#code-examples-from-our-codebase)

---

## Overview

**Module Federation** is a webpack feature that allows separate JavaScript builds to share code at runtime without requiring bundling at build time. This is the foundation of our micro frontend architecture.

### What Problem Does It Solve?

**Traditional approach (doesn't scale)**:
```
Host App build includes:
  ├── Host code
  ├── MFE #1 code (bundled)
  ├── MFE #2 code (bundled)
  └── MFE #3 code (bundled)
```
Problems:
- Must rebuild host when any MFE changes
- Massive bundle size
- No independent deployment
- Tight coupling

**Module Federation approach (scalable)**:
```
Host App build:
  └── Host code + references to remote MFEs

MFE #1 build (deployed separately):
  └── MFE #1 code

MFE #2 build (deployed separately):
  └── MFE #2 code
```
Benefits:
- Independent deployments
- Lazy loading
- Shared dependencies
- Loose coupling

---

## Architecture Split: Build Time vs Runtime

```
┌─────────────────────────────────────────────────────────────────┐
│                         BUILD TIME                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  React Remote (Pink)           React Remote (Orange)            │
│  ┌──────────────────┐          ┌──────────────────┐            │
│  │ webpack.config.js│          │ webpack.config.js│            │
│  │                  │          │                  │            │
│  │ name: reactRemote│          │ name: reactOrange│            │
│  │ exposes:         │          │ exposes:         │            │
│  │   './App'        │          │   './App'        │            │
│  │ shared:          │          │ shared:          │            │
│  │   react          │          │   react          │            │
│  └─────────┬────────┘          └─────────┬────────┘            │
│            │                              │                     │
│            ▼                              ▼                     │
│  ┌──────────────────┐          ┌──────────────────┐            │
│  │ remoteEntry.js   │          │ remoteEntry.js   │            │
│  │ (port 5001)      │          │ (port 5002)      │            │
│  └──────────────────┘          └──────────────────┘            │
│                                                                  │
│  Angular Host                                                   │
│  ┌──────────────────────────────────────┐                      │
│  │ webpack.config.js                    │                      │
│  │                                      │                      │
│  │ name: angularHost                   │                      │
│  │ remotes:                            │                      │
│  │   reactRemote: 'reactRemote@...'   │                      │
│  │   reactOrange: 'reactOrange@...'   │                      │
│  │ shared:                             │                      │
│  │   @angular/core                     │                      │
│  └──────────────────────────────────────┘                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                         RUNTIME                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. User clicks "Load Pink" button                              │
│                                                                  │
│  2. Angular host dynamically loads:                             │
│     http://localhost:5001/remoteEntry.js                        │
│                                                                  │
│  3. remoteEntry.js creates:                                     │
│     window.reactRemote = { get, init }                          │
│                                                                  │
│  4. Host calls: reactRemote.get('./App')                        │
│                                                                  │
│  5. Returns: bootstrap module (mount/unmount)                   │
│                                                                  │
│  6. Host calls: bootstrap.mount(container, context)             │
│                                                                  │
│  7. React component renders in container                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Webpack Configurations

### React Remote (Pink) Configuration

**File**: [react-remote/webpack.config.js](react-remote/webpack.config.js)

```javascript
const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');

module.exports = {
  entry: './src/index.tsx',
  mode: 'development',

  // Step 1: Serve on port 5001
  devServer: {
    port: 5001,
    headers: {
      'Access-Control-Allow-Origin': '*',  // Allow cross-origin loading
    },
  },

  output: {
    publicPath: 'http://localhost:5001/',  // Where files are served from
  },

  plugins: [
    new ModuleFederationPlugin({
      // Step 2: Container name (becomes window.reactRemote)
      name: 'reactRemote',

      // Step 3: Entry file that creates the container
      filename: 'remoteEntry.js',

      // Step 4: What we expose to other apps
      exposes: {
        './App': './src/bootstrap',  // Exposes bootstrap.tsx as './App'
      },

      // Step 5: Shared dependencies (prevents duplicate loading)
      shared: {
        react: {
          singleton: true,              // Only one version in the page
          requiredVersion: '^18.2.0',  // Version constraint
        },
        'react-dom': {
          singleton: true,
          requiredVersion: '^18.2.0',
        },
      },
    }),
  ],
};
```

### Angular Host Configuration

**File**: [angular-host/webpack.config.js](angular-host/webpack.config.js)

```javascript
const ModuleFederationPlugin = require("webpack/lib/container/ModuleFederationPlugin");

module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      // Step 1: This app's name
      name: "angularHost",

      // Step 2: Remote MFEs we want to consume
      remotes: {
        reactRemote: "reactRemote@http://localhost:5001/remoteEntry.js",
        reactOrange: "reactOrange@http://localhost:5002/remoteEntry.js",
      },

      // Step 3: Shared dependencies (matches remote's versions)
      shared: {
        "@angular/core": {
          singleton: true,
          strictVersion: false,
          requiredVersion: "auto"
        },
        "@angular/common": {
          singleton: true,
          strictVersion: false,
          requiredVersion: "auto"
        },
        // ... other Angular packages
      }
    })
  ],
};
```

---

## The Complete Execution Flow

Let's trace what happens when a user clicks "Load Pink Remote" in the Angular host.

### Step 1: User Interaction

**Location**: [angular-host/src/app/app.component.ts](angular-host/src/app/app.component.ts:39)

```typescript
async loadPinkRemote() {
  await this.loadMFE('reactRemote', 'reactRemote', '1.0.0', 'react');
}
```

### Step 2: MFE Loader Service Called

**Location**: [angular-host/src/app/mfe-loader.service.ts](angular-host/src/app/mfe-loader.service.ts:35)

```typescript
async loadMFE(
  config: MFELoadConfig,
  container: HTMLElement
): Promise<MFEInstance> {
  console.log(`[MFELoaderService] Loading MFE: ${config.name}`);

  // Delegates to the abstraction layer
  const lifecycle = await this.loader.load(config);
  // ...
}
```

### Step 3: Module Federation Loader Loads Remote

**Location**: [shared/mfe-core/src/module-federation-loader.ts](shared/mfe-core/src/module-federation-loader.ts:44)

```typescript
async load(config: MFELoadConfig): Promise<MFELifecycle> {
  const remoteUrl = `${config.url}/remoteEntry.js`;

  // Load the remote entry script
  if (!this.loadedScripts.has(remoteUrl)) {
    await this.loadScript(remoteUrl, config.name);
    this.loadedScripts.add(remoteUrl);
  }

  // Access the container
  const container = (window as any)[config.name];
  if (!container) {
    throw new Error(`Container '${config.name}' not found`);
  }

  // Initialize shared scope
  await container.init(__webpack_share_scopes__.default);

  // Get the exposed module
  const factory = await container.get(config.module);
  const module = factory();

  return module.lifecycle || module;
}
```

**What's happening here?**

#### Step 3a: Load Script

```typescript
private loadScript(url: string, mfeName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;  // 'http://localhost:5001/remoteEntry.js'
    script.onload = () => {
      this.scriptElements.set(mfeName, script);
      resolve();
    };
    document.head.appendChild(script);
  });
}
```

This injects:
```html
<head>
  <script src="http://localhost:5001/remoteEntry.js"></script>
</head>
```

#### Step 3b: Script Execution Creates Container

When `remoteEntry.js` loads, webpack generates code that creates:

```javascript
window.reactRemote = {
  get: function(moduleName) {
    // Returns a factory function for the requested module
    if (moduleName === './App') {
      return () => import('./src/bootstrap');
    }
  },

  init: function(sharedScope) {
    // Negotiates shared dependencies
    // Compares versions, picks singleton, etc.
  }
};
```

#### Step 3c: Initialize Shared Scope

```typescript
await container.init(__webpack_share_scopes__.default);
```

This negotiates shared dependencies:

```
Host has:     react@18.2.0
Remote wants: react@^18.2.0

Result: ✓ Use host's react@18.2.0 (singleton)
```

#### Step 3d: Get the Module

```typescript
const factory = await container.get('./App');  // Get the module factory
const module = factory();                       // Execute it to get exports
```

**Translation**:
```javascript
// container.get('./App') returns:
() => import('./src/bootstrap')

// factory() executes the import and returns:
{
  mount: async function(container, context) { /* ... */ },
  unmount: async function(instance) { /* ... */ }
}
```

### Step 4: Mount the MFE

**Location**: [react-remote/src/bootstrap.tsx](react-remote/src/bootstrap.tsx:4)

```typescript
export async function mount(
  container: HTMLElement,
  context: any
): Promise<any> {
  console.log('[React Bootstrap] Mounting with context:', context);

  // Set data attribute for CSS scoping
  container.setAttribute('data-mfe', 'react-pink');

  // Create React root
  const root = ReactDOM.createRoot(container);

  // Render the app
  root.render(
    <React.StrictMode>
      <App eventBus={context.eventBus} />
    </React.StrictMode>
  );

  // Return instance handle
  return {
    _internal: { root, container },
    id: `react-${Date.now()}`,
    mfeName: context.metadata?.mfeName || 'reactRemote',
    mountedAt: new Date(),
    isHealthy: () => root !== null
  };
}
```

### Step 5: React Component Renders

**Location**: [react-remote/src/App.tsx](react-remote/src/App.tsx:19)

```typescript
const App: React.FC<AppProps> = ({ eventBus }) => {
  const [messageInput, setMessageInput] = useState('');

  // Load persisted messages from localStorage
  const [receivedMessage, setReceivedMessage] = useState(() => {
    const saved = localStorage.getItem('react-pink-receivedMessage');
    return saved || '';
  });

  // Subscribe to event bus
  useEffect(() => {
    if (!eventBus) return;

    const unsubscribe = eventBus.subscribeToMessages((event: MessageEvent) => {
      if (event.from === 'angular') {
        setReceivedMessage(event.message);
        setLastMessageFrom('Angular (Blue)');
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();  // Cleanup on unmount
    };
  }, [eventBus]);

  return (
    <div className="react-app">
      <h1>React Remote (Pink)</h1>
      {/* UI components */}
    </div>
  );
}
```

### Step 6: User Sees the MFE

The pink React component is now rendered in the Angular host's container:

```html
<div id="mfe-container" data-mfe="react-pink">
  <div class="react-app">
    <h1>React Remote (Pink)</h1>
    <!-- React UI rendered here -->
  </div>
</div>
```

The CSS applies because of the scoping:

```css
[data-mfe="react-pink"] .react-app {
  background: linear-gradient(135deg, #ff6b9d 0%, #c06c84 100%);
  /* ... */
}
```

### Step 7: Switching to Orange

When user clicks "Load Orange Remote":

1. **Unload Pink**: [mfe-loader.service.ts:84](angular-host/src/app/mfe-loader.service.ts:84)
   ```typescript
   await this.unloadMFE('reactRemote');
   ```

2. **React unmounts**: [bootstrap.tsx:32](react-remote/src/bootstrap.tsx:32)
   ```typescript
   root.unmount();
   container.innerHTML = '';
   container.removeAttribute('data-mfe');
   ```

3. **Load Orange**: Same flow as above, but:
   - Different URL: `http://localhost:5002/remoteEntry.js`
   - Different container: `window.reactOrange`
   - Different data attribute: `data-mfe="react-orange"`

4. **CSS switches**: Orange styles apply because:
   ```css
   [data-mfe="react-orange"] .react-app {
     background: linear-gradient(135deg, #ff8c42 0%, #ff6b35 100%);
   }
   ```

### Step 8: Switching Back to Pink

**Critical behavior**: Pink CSS is ALREADY loaded in `<head>` (webpack cached it)

When switching back:
1. Container gets `data-mfe="react-pink"` again
2. Pink CSS rules activate (they never left the DOM)
3. Orange CSS rules deactivate (selector no longer matches)
4. Messages restore from localStorage

---

## Key Concepts Illustrated

### 1. Container Object

**What is it?**
A global object created by `remoteEntry.js` that provides access to exposed modules.

**Example**:
```javascript
window.reactRemote = {
  get: (moduleName) => { /* returns module factory */ },
  init: (sharedScope) => { /* negotiates dependencies */ }
}
```

**In our code**: [module-federation-loader.ts:60](shared/mfe-core/src/module-federation-loader.ts:60)
```typescript
const container = (window as any)[config.name];  // Access window.reactRemote
```

### 2. Exposes

**What is it?**
Configuration that declares which modules a remote MFE makes available.

**Example**: [react-remote/webpack.config.js:47](react-remote/webpack.config.js:47)
```javascript
exposes: {
  './App': './src/bootstrap',  // Expose bootstrap.tsx as './App'
}
```

**Translation**:
```
External name: './App'  (what consumers see)
Internal path: './src/bootstrap'  (actual file)
```

**In our code**: [module-federation-loader.ts:75](shared/mfe-core/src/module-federation-loader.ts:75)
```typescript
const factory = await container.get('./App');  // Request './App'
```

### 3. Remotes

**What is it?**
Configuration that declares which remote MFEs a host can consume.

**Example**: [angular-host/webpack.config.js:16](angular-host/webpack.config.js:16)
```javascript
remotes: {
  reactRemote: "reactRemote@http://localhost:5001/remoteEntry.js",
  reactOrange: "reactOrange@http://localhost:5002/remoteEntry.js",
}
```

**Translation**:
```
Local alias: reactRemote
Container name: reactRemote
URL: http://localhost:5001/remoteEntry.js
```

### 4. Shared Dependencies

**What is it?**
Dependencies that should be loaded only once and shared between host and remotes.

**Example**: [react-remote/webpack.config.js:50](react-remote/webpack.config.js:50)
```javascript
shared: {
  react: {
    singleton: true,              // Only one version allowed
    requiredVersion: '^18.2.0',  // Version constraint
  }
}
```

**Runtime negotiation**:
```
Host has:     react@18.2.0
Remote wants: react@^18.2.0

Negotiation:
  ✓ Versions compatible
  ✓ Singleton enforced

Result: Both use react@18.2.0 from host
```

**Why it matters**:
Without singleton, you'd have multiple React instances, breaking hooks and context.

### 5. Lazy Loading

**What is it?**
Modules are loaded on-demand, not at initial page load.

**In our code**:
```typescript
// When page loads: No React MFEs loaded yet
// User clicks "Load Pink": NOW we load http://localhost:5001/remoteEntry.js
// User clicks "Load Orange": NOW we load http://localhost:5002/remoteEntry.js
```

**Benefits**:
- Smaller initial bundle
- Faster page load
- Load only what's needed

---

## Visual Diagrams

### Complete Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                    User Clicks "Load Pink"                           │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│  app.component.ts                                                    │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │ loadPinkRemote() {                                         │     │
│  │   this.loadMFE('reactRemote', ...)                        │     │
│  │ }                                                          │     │
│  └────────────────────────────────────────────────────────────┘     │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│  mfe-loader.service.ts                                               │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │ loadMFE(config, container) {                              │     │
│  │   const lifecycle = await this.loader.load(config)        │     │
│  │   return await lifecycle.mount(container, context)        │     │
│  │ }                                                          │     │
│  └────────────────────────────────────────────────────────────┘     │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│  module-federation-loader.ts                                         │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │ load(config) {                                            │     │
│  │   // 1. Load script                                       │     │
│  │   await this.loadScript(remoteUrl, config.name)          │     │
│  │                                                           │     │
│  │   // 2. Get container                                    │     │
│  │   const container = window[config.name]                  │     │
│  │                                                           │     │
│  │   // 3. Initialize shared scope                          │     │
│  │   await container.init(sharedScope)                      │     │
│  │                                                           │     │
│  │   // 4. Get module                                       │     │
│  │   const factory = await container.get('./App')           │     │
│  │   const module = factory()                               │     │
│  │                                                           │     │
│  │   return module.lifecycle                                │     │
│  │ }                                                          │     │
│  └────────────────────────────────────────────────────────────┘     │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
                ▼                         ▼
┌──────────────────────────┐   ┌──────────────────────────┐
│  loadScript()            │   │  Shared Scope Init       │
│  ┌────────────────────┐  │   │  ┌────────────────────┐  │
│  │ <script src=       │  │   │  │ Host: react@18.2  │  │
│  │  "http://...       │  │   │  │ Remote: react^18  │  │
│  │   remoteEntry.js"> │  │   │  │                   │  │
│  │ </script>          │  │   │  │ Result: Share     │  │
│  └────────────────────┘  │   │  │  host's version   │  │
│           │              │   │  └────────────────────┘  │
│           ▼              │   └──────────────────────────┘
│  Creates window.         │
│  reactRemote             │
└──────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────────────────────┐
│  bootstrap.tsx                                                       │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │ export async function mount(container, context) {         │     │
│  │   container.setAttribute('data-mfe', 'react-pink')        │     │
│  │   const root = ReactDOM.createRoot(container)             │     │
│  │   root.render(<App eventBus={context.eventBus} />)        │     │
│  │   return { _internal: { root, container }, ... }          │     │
│  │ }                                                          │     │
│  └────────────────────────────────────────────────────────────┘     │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│  App.tsx                                                             │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │ const App = ({ eventBus }) => {                           │     │
│  │   // useState hooks                                       │     │
│  │   // useEffect for event bus subscription                │     │
│  │   // useEffect for localStorage persistence              │     │
│  │                                                           │     │
│  │   return (                                                │     │
│  │     <div className="react-app">                          │     │
│  │       <h1>React Remote (Pink)</h1>                       │     │
│  │       {/* UI components */}                              │     │
│  │     </div>                                                │     │
│  │   )                                                       │     │
│  │ }                                                          │     │
│  └────────────────────────────────────────────────────────────┘     │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       Rendered in Browser                            │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │ <div id="mfe-container" data-mfe="react-pink">            │     │
│  │   <div class="react-app">                                 │     │
│  │     <h1>React Remote (Pink)</h1>                          │     │
│  │     <div class="message-box">...</div>                    │     │
│  │   </div>                                                  │     │
│  │ </div>                                                    │     │
│  └────────────────────────────────────────────────────────────┘     │
│                                                                      │
│  CSS Applied:                                                       │
│  [data-mfe="react-pink"] .react-app {                              │
│    background: linear-gradient(135deg, #ff6b9d 0%, #c06c84 100%); │
│  }                                                                  │
└──────────────────────────────────────────────────────────────────────┘
```

### Shared Dependency Negotiation

```
┌─────────────────────────────────────────────────────────────┐
│                  Shared Scope Initialization                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Host (angularHost)                                         │
│  ┌───────────────────────────────────────┐                 │
│  │ shared: {                             │                 │
│  │   react: {                            │                 │
│  │     version: '18.2.0',               │                 │
│  │     singleton: true                   │                 │
│  │   }                                   │                 │
│  │ }                                     │                 │
│  └───────────────────────────────────────┘                 │
│                                                             │
│  Remote (reactRemote)                                      │
│  ┌───────────────────────────────────────┐                 │
│  │ shared: {                             │                 │
│  │   react: {                            │                 │
│  │     requiredVersion: '^18.2.0',      │                 │
│  │     singleton: true                   │                 │
│  │   }                                   │                 │
│  │ }                                     │                 │
│  └───────────────────────────────────────┘                 │
│                                                             │
│  Negotiation Process:                                      │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ 1. Compare versions:                                  │ │
│  │    Host has: 18.2.0                                  │ │
│  │    Remote wants: ^18.2.0                            │ │
│  │    ✓ Compatible                                      │ │
│  │                                                       │ │
│  │ 2. Check singleton:                                   │ │
│  │    Both require singleton: true                      │ │
│  │    ✓ Enforced                                        │ │
│  │                                                       │ │
│  │ 3. Resolution:                                        │ │
│  │    Use host's react@18.2.0                          │ │
│  │    Remote imports from host's bundle                 │ │
│  │                                                       │ │
│  │ 4. Result:                                            │ │
│  │    Only ONE React instance in the entire page       │ │
│  │    Both Angular and React MFEs use the same one     │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Code Examples from Our Codebase

### Example 1: Loading Remote Script

**File**: [module-federation-loader.ts:24](shared/mfe-core/src/module-federation-loader.ts:24)

```typescript
private loadScript(url: string, mfeName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Create script element
    const script = document.createElement('script');
    script.src = url;
    script.type = 'text/javascript';
    script.setAttribute('data-mfe-script', mfeName);

    script.onload = () => {
      console.log(`[ModuleFederationLoader] Script loaded: ${url}`);
      this.scriptElements.set(mfeName, script);
      resolve();
    };

    script.onerror = (error) => {
      console.error(`[ModuleFederationLoader] Failed to load script: ${url}`, error);
      reject(new Error(`Failed to load remote entry: ${url}`));
    };

    // Inject into DOM
    document.head.appendChild(script);
  });
}
```

**What happens**:
1. Creates `<script>` element
2. Sets `src` to `http://localhost:5001/remoteEntry.js`
3. Waits for `onload` event
4. Script executes and creates `window.reactRemote`
5. Promise resolves

### Example 2: Accessing Container

**File**: [module-federation-loader.ts:60](shared/mfe-core/src/module-federation-loader.ts:60)

```typescript
// At this point, remoteEntry.js has already executed
// and created window.reactRemote = { get, init }

const container = (window as any)[config.name];
if (!container) {
  throw new Error(
    `Remote container '${config.name}' not found on window object. ` +
    `Make sure the remote entry script loaded successfully.`
  );
}

console.log(`[ModuleFederationLoader] Container '${config.name}' found`);
```

**What happens**:
1. Looks up `window['reactRemote']`
2. Verifies container exists
3. Container has `get()` and `init()` methods

### Example 3: Getting Module Factory

**File**: [module-federation-loader.ts:75](shared/mfe-core/src/module-federation-loader.ts:75)

```typescript
// Initialize shared dependencies
await container.init(__webpack_share_scopes__.default);

// Get the module factory (lazy loaded)
const factory = await container.get(config.module);  // config.module = './App'

// Execute factory to get actual exports
const module = factory();

// Extract lifecycle methods
const lifecycle = module.lifecycle || module;

return lifecycle;
```

**What happens**:
1. `container.init()` negotiates shared dependencies
2. `container.get('./App')` returns a promise that resolves to a factory function
3. `factory()` executes the factory, triggering webpack's module loading
4. Returns the actual module exports: `{ mount, unmount }`

### Example 4: Mount Implementation

**File**: [bootstrap.tsx:4](react-remote/src/bootstrap.tsx:4)

```typescript
export async function mount(
  container: HTMLElement,
  context: any
): Promise<any> {
  console.log('[React Bootstrap] Mounting with context:', context);

  // Set data attribute for CSS scoping
  container.setAttribute('data-mfe', 'react-pink');

  // Create React 18 root
  const root = ReactDOM.createRoot(container);

  // Render application
  root.render(
    <React.StrictMode>
      <App eventBus={context.eventBus} />
    </React.StrictMode>
  );

  // Return instance handle with cleanup capabilities
  return {
    _internal: { root, container },
    id: `react-${Date.now()}`,
    mfeName: context.metadata?.mfeName || 'reactRemote',
    mountedAt: new Date(),
    isHealthy: () => root !== null
  };
}
```

**Key points**:
- Uses React 18's `createRoot` API
- Sets `data-mfe` attribute for CSS scoping
- Passes `eventBus` from context to enable communication
- Returns instance handle for later cleanup

### Example 5: Unmount Implementation

**File**: [bootstrap.tsx:32](react-remote/src/bootstrap.tsx:32)

```typescript
export async function unmount(instance: any): Promise<void> {
  console.log('[React Bootstrap] Unmounting');

  const { root, container } = instance._internal;

  if (root) {
    // React 18's unmount method
    root.unmount();
    console.log('[React Bootstrap] React root unmounted');
  }

  if (container) {
    // Clean up DOM
    container.innerHTML = '';
    container.removeAttribute('data-mfe');
    console.log('[React Bootstrap] Container cleaned up');
  }
}
```

**Key points**:
- Properly unmounts React root (prevents memory leaks)
- Clears container DOM
- Removes data attribute (CSS rules no longer apply)

### Example 6: Event Bus Integration

**File**: [App.tsx:46](react-remote/src/App.tsx:46)

```typescript
useEffect(() => {
  if (!eventBus) {
    console.warn('[React] No event bus provided');
    return;
  }

  // Subscribe to messages from Angular
  const unsubscribe = eventBus.subscribeToMessages((event: MessageEvent) => {
    if (event.from === 'angular') {
      setReceivedMessage(event.message);
      setLastMessageFrom('Angular (Blue)');
      console.log('[React Pink] Received message from Angular:', event.message);
    }
  });

  // Cleanup function called on unmount
  return () => {
    if (unsubscribe) {
      unsubscribe();
      console.log('[React Pink] Event bus subscription cleaned up');
    }
  };
}, [eventBus]);
```

**Key points**:
- Subscribes to event bus on mount
- Returns cleanup function for unmount
- Prevents subscription accumulation (critical pitfall)

### Example 7: localStorage Persistence

**File**: [App.tsx:22](react-remote/src/App.tsx:22)

```typescript
// Load persisted message state from localStorage on mount
const [receivedMessage, setReceivedMessage] = useState(() => {
  const saved = localStorage.getItem('react-pink-receivedMessage');
  return saved || '';
});

const [lastMessageFrom, setLastMessageFrom] = useState(() => {
  const saved = localStorage.getItem('react-pink-lastMessageFrom');
  return saved || '';
});

// Persist message state to localStorage whenever it changes
useEffect(() => {
  if (receivedMessage) {
    localStorage.setItem('react-pink-receivedMessage', receivedMessage);
  }
}, [receivedMessage]);

useEffect(() => {
  if (lastMessageFrom) {
    localStorage.setItem('react-pink-lastMessageFrom', lastMessageFrom);
  }
}, [lastMessageFrom]);
```

**Key points**:
- State initializer loads from localStorage
- useEffect persists changes
- Unique keys per MFE prevent collision
- Messages survive MFE unmount/remount cycles

---

## Summary

### What Module Federation Enables

1. **Independent Deployments**
   - React Pink can deploy without rebuilding Angular host
   - Each MFE has its own CI/CD pipeline

2. **Lazy Loading**
   - MFEs loaded on-demand, not at initial page load
   - Faster initial page load

3. **Shared Dependencies**
   - Only one React instance despite multiple React MFEs
   - Reduced bundle size
   - No version conflicts

4. **Framework Agnostic**
   - Angular host consuming React remotes
   - Could add Vue, Svelte, etc.

5. **Runtime Composition**
   - No build-time coupling
   - Dynamic remote selection

### The Magic Explained

**Build time**:
- Webpack analyzes your code
- Creates containers with `get()` and `init()` methods
- Generates `remoteEntry.js` files

**Runtime**:
- Host loads `remoteEntry.js` via `<script>` tag
- Remote creates `window.containerName` object
- Host calls `container.get('./Module')` to lazy load code
- Shared dependencies negotiated to prevent duplicates

**In our demo**:
- Angular host (blue) loads React remotes (pink & orange)
- Remotes share React/ReactDOM with host
- Communication via event bus (global singleton)
- State persists via localStorage
- CSS scoped via data attributes

---

## Additional Resources

### Internal Documentation

- [CLAUDE.md - Common Pitfalls](./CLAUDE.md#common-pitfalls--how-to-avoid-them)
- [MFE Abstraction Strategy](./mfe-abstraction-strategy.md)
- [Micro Frontend Strategy](./micro-frontend-strategy.md)

### Webpack Documentation

- [Module Federation Plugin](https://webpack.js.org/plugins/module-federation-plugin/)
- [Shared Modules](https://webpack.js.org/plugins/module-federation-plugin/#sharing-hints)

### Code Files Referenced

- [angular-host/webpack.config.js](./angular-host/webpack.config.js)
- [react-remote/webpack.config.js](./react-remote/webpack.config.js)
- [shared/mfe-core/src/module-federation-loader.ts](./shared/mfe-core/src/module-federation-loader.ts)
- [react-remote/src/bootstrap.tsx](./react-remote/src/bootstrap.tsx)
- [react-remote/src/App.tsx](./react-remote/src/App.tsx)

---

**Last Updated**: November 2025
**Author**: Generated from live demo walkthrough
**Review Cycle**: Update when webpack configuration changes
