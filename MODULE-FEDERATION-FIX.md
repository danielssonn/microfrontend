# Module Federation "Eager Consumption" Fix

## The Problem

When using Module Federation with shared dependencies, you might encounter this error:

```
Uncaught Error: Shared module is not available for eager consumption
```

## Why This Happens

Module Federation needs to:
1. Load the remote entry point
2. Initialize shared module scope
3. Register shared dependencies
4. **THEN** start your application

But if your `main.ts` directly imports Angular modules, they're loaded **immediately** (eagerly), before Module Federation has a chance to set up the shared scope.

## The Solution: Bootstrap Pattern

We split the application into two files:

### 1. `main.ts` - Entry Point (Async)
```typescript
// Import bootstrap asynchronously to avoid eager consumption error
// This allows Module Federation to initialize shared modules first
import('./bootstrap').catch(err => console.error('Error loading bootstrap:', err));
```

This is the **webpack entry point**. It does a dynamic `import()` which:
- ✅ Gives Module Federation time to initialize
- ✅ Waits for shared modules to be ready
- ✅ Then loads the actual bootstrap code

### 2. `bootstrap.ts` - Actual App Bootstrap
```typescript
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app/app.module';

console.log('[Bootstrap] Starting Angular application...');

platformBrowserDynamic()
  .bootstrapModule(AppModule)
  .then(() => {
    console.log('[Bootstrap] Angular application bootstrapped successfully!');
  })
  .catch((err) => {
    console.error('[Bootstrap] Bootstrap error:', err);
  });
```

This file contains the **actual Angular bootstrap code**. Because it's dynamically imported, Angular modules are only loaded **after** Module Federation is ready.

## The Flow

```
1. Webpack loads main.ts
   ↓
2. main.ts triggers async import('./bootstrap')
   ↓
3. Module Federation initializes shared scope
   ↓ (meanwhile)
4. Module Federation registers @angular/core, @angular/common, etc.
   ↓
5. bootstrap.ts is loaded
   ↓
6. Angular modules are imported (now they're available!)
   ↓
7. Angular app starts successfully
```

## This Pattern Is Required For:

- ✅ **Host applications** using Module Federation with shared dependencies
- ✅ **Remote applications** that can also run standalone
- ✅ Any app that shares framework libraries (React, Angular, Vue)

## Without This Pattern:

```typescript
// ❌ DON'T DO THIS in main.ts when using Module Federation
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic'; // EAGER!
import { AppModule } from './app/app.module'; // EAGER!

platformBrowserDynamic().bootstrapModule(AppModule); // FAILS!
```

This causes the "eager consumption" error because:
1. `main.ts` is the entry point
2. Webpack immediately executes all imports in `main.ts`
3. `@angular/platform-browser-dynamic` is imported eagerly
4. But Module Federation hasn't initialized the shared @angular modules yet
5. **Error!** Shared module not available

## With This Pattern:

```typescript
// ✅ DO THIS in main.ts
import('./bootstrap'); // ASYNC! Gives Module Federation time to initialize
```

Then in `bootstrap.ts`:
```typescript
// These imports happen AFTER Module Federation is ready
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app/app.module';
// ... bootstrap app
```

## Files Updated

1. **Created**: `src/bootstrap.ts` - Contains actual Angular bootstrap code
2. **Updated**: `src/main.ts` - Now just does async import of bootstrap

## Verification

After this fix, you should see:

```
Console Output:
[Bootstrap] Starting Angular application...
[Bootstrap] Angular application bootstrapped successfully!
[Angular] AppComponent constructor called
[Angular] AppComponent ngOnInit called
```

No more "Shared module is not available for eager consumption" errors!

## References

- [Module Federation Docs - Shared Modules](https://webpack.js.org/concepts/module-federation/#shared)
- [Angular Architects - Module Federation Guide](https://www.angulararchitects.io/aktuelles/the-microfrontend-revolution-module-federation-in-webpack-5/)

---

**This is a standard Module Federation pattern and is used by React, Vue, and Angular applications that use Module Federation.**
