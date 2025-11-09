# Troubleshooting Guide

## Angular Host Not Rendering

If the Angular host (blue app) is not showing at all, follow these steps:

### Step 1: Check Console Output

Open Browser DevTools (F12) → Console tab

Look for these messages in order:

1. **`[Main] Starting Angular application...`**
   - ✅ If you see this: Main.ts loaded correctly
   - ❌ If missing: Check if `src/main.ts` is being loaded

2. **`[Main] Angular application bootstrapped successfully!`**
   - ✅ If you see this: Angular is running
   - ❌ If missing: Check console for bootstrap errors

3. **`[Angular] AppComponent constructor called`**
   - ✅ If you see this: Component is being created
   - ❌ If missing: Check app.module.ts bootstrap configuration

4. **`[Angular] AppComponent ngOnInit called`**
   - ✅ If you see this: Component lifecycle is working
   - ❌ If missing: Check for component initialization errors

### Step 2: Check for Errors

Common errors and solutions:

#### Error: "Cannot find module '@angular-builders/custom-webpack'"

**Solution:**
```bash
cd angular-host
npm install
```

If that doesn't work:
```bash
cd angular-host
rm -rf node_modules package-lock.json
npm install
```

#### Error: "Builder @angular-builders/custom-webpack:browser not found"

The custom webpack builder might not be installed properly.

**Solution - Option 1** (Reinstall):
```bash
cd angular-host
npm install @angular-builders/custom-webpack@^17.0.0 --save-dev
npm install webpack@^5.89.0 --save-dev
```

**Solution - Option 2** (Temporarily disable custom webpack):

Edit `angular-host/angular.json`, change:
```json
"builder": "@angular-builders/custom-webpack:browser"
```
to:
```json
"builder": "@angular-devkit/build-angular:browser"
```

And remove the `customWebpackConfig` section.

#### Error: Blank white page, no console logs

1. Check if Angular is actually running:
   ```bash
   lsof -i :4200
   ```
   Should show `ng` or `node` process

2. Check the network tab - is `main.js` loading?

3. Try accessing: http://localhost:4200/main.js
   - Should show JavaScript code
   - If 404: Build failed, check terminal for errors

### Step 3: Verify File Structure

Make sure these files exist:

```bash
cd angular-host
ls -la src/app/
```

Should show:
- `app.component.ts`
- `app.component.html`
- `app.component.css`
- `app.module.ts`
- `event-bus.service.ts`

### Step 4: Check Build Output

In the terminal where you ran `npm start`, look for:

✅ **Success:**
```
** Angular Live Development Server is listening on localhost:4200
** Compiled successfully.
```

❌ **Error:**
```
Error: ...
✖ Failed to compile
```

If you see errors, read them carefully and fix before proceeding.

---

## React Remote Not Loading

If the Angular app shows but the pink React app doesn't appear:

### Step 1: Verify React is Running

```bash
lsof -i :5001
```

Should show `node` or `webpack-dev-server`

### Step 2: Test React Remote Directly

Open: http://localhost:5001

- ✅ Should show the React app (pink) in standalone mode
- ❌ If 404 or connection refused: React isn't running

### Step 3: Test Module Federation Entry

Open: http://localhost:5001/remoteEntry.js

- ✅ Should show JavaScript code
- ❌ If error: Module Federation not configured correctly

### Step 4: Check Browser Console

Look for these specific messages:

1. **`[Angular] loadReactRemote() called`**
   - ✅ Angular is trying to load React
   - ❌ If missing: Angular app might not have started properly

2. **`[Angular] react-container found`**
   - ✅ Container element exists in DOM
   - ❌ If NOT FOUND: Check app.component.html has `<div id="react-container"></div>`

3. **`[Angular] React remote loaded successfully!`**
   - ✅ Module Federation working
   - ❌ If error: Check Module Federation configuration

Common errors:

#### Error: "Shared module is not available for eager consumption"

This means Module Federation configuration mismatch.

**Check:**
1. React webpack.config.js has `exposes: { './App': './src/bootstrap' }`
2. Angular webpack.config.js has `remotes: { reactRemote: "reactRemote@http://localhost:5001/remoteEntry.js" }`

#### Error: "reactRemote.mount is not a function"

The React module isn't exporting the mount function correctly.

**Check `react-remote/src/bootstrap.tsx`:**
```typescript
export function mount(container: HTMLElement, props: any) {
  // ...
}
```

Must be exported at top level.

---

## Neither App Rendering

### Nuclear Option: Clean Reinstall

```bash
# React Remote
cd react-remote
rm -rf node_modules package-lock.json dist
npm install

# Angular Host
cd ../angular-host
rm -rf node_modules package-lock.json .angular dist
npm install
```

Then restart both applications.

---

## Testing Checklist

Use this to verify everything step by step:

### React Remote

- [ ] `cd react-remote && npm install` completes without errors
- [ ] `npm start` shows "compiled successfully"
- [ ] http://localhost:5001 shows React app
- [ ] http://localhost:5001/remoteEntry.js returns JavaScript

### Angular Host

- [ ] `cd angular-host && npm install` completes without errors
- [ ] `npm start` shows "compiled successfully"
- [ ] http://localhost:4200 loads (even if blank)
- [ ] Browser console shows `[Main] Starting Angular application...`
- [ ] Browser console shows `[Main] Angular application bootstrapped successfully!`
- [ ] Browser console shows `[Angular] AppComponent constructor called`
- [ ] Page shows blue background with "Angular Host (Blue)" text
- [ ] Input box and button visible

### Integration

- [ ] Browser console shows `[Angular] loadReactRemote() called`
- [ ] Browser console shows `[Angular] react-container found`
- [ ] Browser console shows `[Angular] React remote loaded successfully!`
- [ ] Browser console shows `[Angular] React app mounted successfully!`
- [ ] Pink React app visible inside blue Angular app
- [ ] Can type in Angular input and click "Send to React"
- [ ] Can type in React input and click "Send to Angular"
- [ ] Messages appear in the "Received" sections

---

## Quick Debug Commands

```bash
# Check what's running on ports
lsof -i :5001  # React
lsof -i :4200  # Angular

# Kill processes if needed
kill -9 $(lsof -ti:5001)
kill -9 $(lsof -ti:4200)

# Test if services are accessible
curl -I http://localhost:5001
curl -I http://localhost:4200
curl -I http://localhost:5001/remoteEntry.js

# Check Angular build output
cd angular-host
ls -la dist/angular-host/

# Check React build output
cd react-remote
ls -la dist/
```

---

## Still Not Working?

1. Make sure BOTH terminals are running (React and Angular)
2. Check browser console for ALL error messages
3. Try in incognito/private browsing mode (clears cache)
4. Try a different browser
5. Check the GitHub issues or README for updates

---

**Last Updated**: November 2025
