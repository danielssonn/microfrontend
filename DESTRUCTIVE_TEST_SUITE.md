# MFE Destructive Test Suite

**Purpose**: Aggressively test micro frontend isolation, lifecycle management, messaging integrity, and memory leak detection.

**File**: [destructive-test-suite.html](destructive-test-suite.html)

---

## Overview

This test suite is designed to **break** your micro frontend architecture by applying extreme stress, rapid operations, and memory pressure. It helps identify:

1. **Cross-lifecycle contamination** - Does one MFE affect another?
2. **Memory leaks** - Do mount/unmount cycles leak memory?
3. **Event bus integrity** - Are subscriptions properly cleaned up?
4. **Messaging isolation** - Are messages properly isolated between channels?
5. **DOM cleanup** - Are DOM nodes removed after unmount?
6. **Race conditions** - Does parallel loading cause issues?

---

## Test Categories

### 1. Lifecycle Tests (6 tests)

Tests that validate MFE mount/unmount behavior and isolation.

| Test | Description | Pass Criteria |
|------|-------------|---------------|
| **Basic Mount/Unmount** | Mount and unmount a single MFE | Both operations succeed |
| **Repeated Mount/Unmount (10x)** | Mount/unmount 10 times in sequence | All 10 cycles succeed |
| **Cross-Contamination** | Load Pink, load Orange, verify Pink still works | Pink survives Orange mount/unmount |
| **Parallel Mount** | Load Pink and Orange simultaneously | Both mount successfully |
| **Out-of-Order Unmount** | Load Pink→Orange, unmount Orange→Pink | Both unmount successfully |
| **Re-mount After Unmount** | Mount→Unmount→Mount again | Second mount succeeds |

**What it catches**:
- Global state pollution
- Shared dependencies conflicts
- Container reuse issues
- CSS namespace collisions

---

### 2. Messaging Tests (5 tests)

Tests that validate event bus isolation and subscription management.

| Test | Description | Pass Criteria |
|------|-------------|---------------|
| **Basic Messaging** | Subscribe and send 2 messages | Both messages received |
| **Message Isolation** | Two separate channels | Each channel receives only its messages |
| **Subscription Cleanup** | Create 10 subscriptions, then unsubscribe | Subscription count returns to initial |
| **Concurrent Messages** | Send 100 messages in parallel | All 100 received |
| **Message Flood Resilience** | Send 1000 messages rapidly | All 1000 processed correctly |

**What it catches**:
- Subscription leaks
- Channel cross-talk
- Handler accumulation
- Event bus memory growth

---

### 3. Memory Leak Tests (4 tests)

Tests that detect memory leaks in lifecycle and messaging.

| Test | Description | Pass Criteria |
|------|-------------|---------------|
| **Memory Leak - Mount/Unmount** | 20 mount/unmount cycles | Memory growth < 5MB |
| **Memory Leak - Messaging** | 1000 subscribe/publish/unsubscribe cycles | Memory growth < 2MB |
| **DOM Cleanup** | Mount→Unmount, count DOM nodes | Node growth < 10 |
| **Event Listener Cleanup** | Mount→Unmount, count subscriptions | Subscriptions return to initial |

**What it catches**:
- React component cleanup failures
- Event listener accumulation
- DOM node retention
- Closure memory retention

**Note**: These tests require Chrome with `--enable-precise-memory-info` flag for accurate memory measurements.

---

### 4. Stress Tests (3 tests)

Tests that apply sustained load to find breaking points.

| Test | Description | Pass Criteria |
|------|-------------|---------------|
| **Rapid Switching (50x)** | Mount/unmount 50 times with minimal delays | All 50 cycles succeed |
| **High Frequency Messaging** | Send 5000 messages rapidly | All 5000 processed |
| **Memory Stress** | 100 mount/unmount cycles with messages | Memory growth < 10MB |

**What it catches**:
- Race conditions
- Async cleanup timing issues
- Memory pressure handling
- Performance degradation

---

### 5. Destructive Tests ⚠️

**EXTREME** tests designed to break the system.

| Test | Description | Expected Behavior |
|------|-------------|-------------------|
| **Rapid Mount/Unmount (100x)** | 100 mount/unmount cycles as fast as possible | Should complete without errors |
| **Parallel MFE Load** | Load multiple MFEs simultaneously | Both load successfully |
| **Message Flood (1000 msgs/sec)** | 10,000 messages sent rapidly | All messages processed |
| **Memory Bomb (500 cycles)** | 500 mount/unmount cycles + message spam | Memory growth < 20MB |

**What it catches**:
- Catastrophic failures under extreme load
- System limits
- Memory explosion scenarios
- Complete system breakdown

---

## How to Use

### Prerequisites

Ensure all MFE servers are running:

```bash
# Start all servers
./start-dev.sh

# Or manually:
cd react-remote && npm start  # Port 5001
cd react-orange && npm start  # Port 5002
cd angular-host && npm start  # Port 4200
```

### Running Tests

**IMPORTANT**: The test suite must be served via HTTP (not opened as file://) to avoid CORS issues.

1. **Serve the test suite:**
   ```bash
   # Option 1: Use the provided script (recommended - auto-finds free port)
   ./serve-test-suite.sh

   # Option 2: Use Python
   python3 -m http.server 8081

   # Option 3: Use npx
   npx http-server -p 8081
   ```

2. **Open in browser:**
   ```
   # If using serve-test-suite.sh, the script will display the URL
   # Otherwise, use:
   http://localhost:8081/destructive-test-suite.html
   ```

3. **For accurate memory tests, launch Chrome with memory profiling:**
   ```bash
   # Note: Replace PORT with the actual port shown by serve-test-suite.sh

   # macOS
   open -a "Google Chrome" --args --enable-precise-memory-info http://localhost:PORT/destructive-test-suite.html

   # Linux
   google-chrome --enable-precise-memory-info http://localhost:PORT/destructive-test-suite.html

   # Windows
   chrome.exe --enable-precise-memory-info http://localhost:PORT/destructive-test-suite.html
   ```

3. **Run tests:**
   - Click "Run All Tests" for complete test suite
   - Or run individual test categories
   - Or run custom stress tests with configurable iterations

### Interpreting Results

#### Real-Time Stats

The dashboard shows:
- **Tests Run/Passed/Failed**: Overall test statistics
- **Memory Usage**: Current heap size (MB) - updated every 2 seconds
- **Active MFE Instances**: Number of currently mounted MFEs
- **Event Subscriptions**: Active event bus subscriptions

#### Test Results

Each test shows:
- **Status**: ✅ Pass | ❌ Fail | ⚠️ Warning
- **Duration**: Time taken in milliseconds
- **Details**: Specific metrics (e.g., "Memory growth: 2.3MB")
- **Error**: Full error message if test failed

#### Color Coding

- 🟢 **Green**: Test passed
- 🔴 **Red**: Test failed
- 🟡 **Yellow**: Warning (passed but close to threshold)
- 🔵 **Blue**: Test running

---

## Expected Results

### Clean Implementation

A **properly isolated** MFE architecture should:

✅ Pass all lifecycle tests
✅ Pass all messaging tests
✅ Show memory growth < 5MB for 20 mount/unmount cycles
✅ Show memory growth < 2MB for 1000 messaging cycles
✅ Complete 100 rapid mount/unmount cycles
✅ Handle 10,000 messages without errors
✅ Show DOM node growth < 10 after unmount
✅ Return to initial subscription count after cleanup

### Common Failures

#### ❌ Cross-Contamination Test Fails

**Symptom**: "Pink survived Orange unmount: false"

**Cause**: MFEs are sharing global state or modifying each other's DOM

**Fix**:
- Use CSS attribute scoping: `[data-mfe="name"]`
- Avoid global variables
- Properly scope event listeners

#### ❌ Memory Leak - Mount/Unmount Fails

**Symptom**: "Memory growth: 12.5MB (threshold: 5MB)"

**Cause**: React components not cleaning up properly

**Fix**:
- Ensure `unmount()` calls `root.unmount()`
- Clean up event listeners in `useEffect` return
- Clear intervals/timeouts
- Remove global references

**Example**:
```typescript
export async function unmount(instance: MFEInstance): Promise<void> {
  const root = instance._internal as ReactDOM.Root;
  if (root) {
    root.unmount();  // ← Critical
  }

  // Clear any global references
  instance._internal = null;
}
```

#### ❌ Subscription Cleanup Fails

**Symptom**: "Subscriptions: 0 → 10 → 5 (expected 0)"

**Cause**: Event listeners not being unsubscribed

**Fix**:
```typescript
useEffect(() => {
  const unsubscribe = eventBus.subscribe('event', handler);

  return () => {
    unsubscribe();  // ← Critical cleanup
  };
}, [eventBus]);
```

#### ❌ DOM Cleanup Fails

**Symptom**: "Node growth: 47"

**Cause**: DOM elements not removed after unmount

**Fix**:
```typescript
// In unmount
container.innerHTML = '';  // ← Clear container

// Or
ReactDOM.unmountComponentAtNode(container);
```

---

## Memory Profiling

### Using Chrome DevTools

1. **Open DevTools** → Performance → Memory

2. **Take heap snapshot before test**:
   - Click "Take snapshot"
   - Label it "Before"

3. **Run destructive test**:
   - Click "Memory Bomb" or "Rapid Mount/Unmount (100x)"

4. **Take heap snapshot after test**:
   - Click "Take snapshot"
   - Label it "After"

5. **Compare snapshots**:
   - Click "Comparison" view
   - Look for retained objects
   - Investigate closures, DOM nodes, event listeners

### What to Look For

**Red flags**:
- Detached DOM trees growing
- Event listener count increasing
- React fiber nodes not being released
- Closure retention in unmounted components

**Example healthy profile**:
```
Before:  45.2 MB heap
After:   47.8 MB heap
Growth:   2.6 MB  ← Acceptable for 100 cycles
```

**Example leak**:
```
Before:  45.2 MB heap
After:   89.7 MB heap
Growth:  44.5 MB  ← Memory leak!
```

---

## Automated Testing

### Integrate with CI/CD

You can run tests headlessly using Puppeteer:

```javascript
// test-runner.js
const puppeteer = require('puppeteer');

async function runTests() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--enable-precise-memory-info']
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:8080/destructive-test-suite.html');

  // Wait for servers to be ready
  await page.waitForTimeout(2000);

  // Run all tests
  await page.evaluate(() => {
    return new Promise((resolve) => {
      window.addEventListener('testsComplete', (event) => {
        resolve(event.detail);
      });
      runAllTests();
    });
  });

  // Get results
  const results = await page.evaluate(() => ({
    testsRun: parseInt(document.getElementById('testsRun').textContent),
    testsPassed: parseInt(document.getElementById('testsPassed').textContent),
    testsFailed: parseInt(document.getElementById('testsFailed').textContent),
  }));

  console.log('Test Results:', results);

  await browser.close();

  if (results.testsFailed > 0) {
    process.exit(1);
  }
}

runTests();
```

---

## Custom Tests

### Writing Your Own Destructive Test

```javascript
async function testMyScenario() {
  const start = performance.now();

  try {
    // 1. Setup
    await loadMFE('reactRemote', 'http://localhost:5001/remoteEntry.js', 'pink-container');

    // 2. Execute test scenario
    for (let i = 0; i < 100; i++) {
      globalEventBus.sendMessage('test', `msg${i}`);
    }

    // 3. Verify state
    const subscriptions = subscriptionCount;

    // 4. Cleanup
    await unloadMFE('reactRemote');

    // 5. Assert
    const passed = subscriptions === 0;
    const duration = performance.now() - start;

    reportTest('My Custom Test', passed, duration, `Subscriptions cleaned up: ${passed}`);
  } catch (error) {
    const duration = performance.now() - start;
    reportTest('My Custom Test', false, duration, 'Failed', error.message);
  }
}
```

---

## Benchmarking

### Performance Targets

Based on production-grade MFE architectures:

| Metric | Target | Acceptable | Poor |
|--------|--------|------------|------|
| **Mount time** | < 100ms | < 200ms | > 500ms |
| **Unmount time** | < 50ms | < 100ms | > 200ms |
| **Memory growth (20 cycles)** | < 3MB | < 5MB | > 10MB |
| **Message throughput** | > 5000 msg/sec | > 1000 msg/sec | < 500 msg/sec |
| **Subscription cleanup** | 100% | 100% | < 100% |

### Optimization Tips

1. **Slow mounts?**
   - Check bundle size
   - Lazy load large dependencies
   - Use code splitting

2. **Memory leaks?**
   - Profile with Chrome DevTools
   - Check for global variables
   - Verify all cleanup paths

3. **Slow messaging?**
   - Batch message sends
   - Debounce high-frequency events
   - Use efficient data structures

---

## Troubleshooting

### "Failed to load script" or 403/CORS errors

**Symptom**: Script loading fails with CORS or 403 errors

**Cause**: Test suite opened as `file://` instead of `http://`

**Solution**:
```bash
# Serve the test suite via HTTP
./serve-test-suite.sh

# Then open http://localhost:8080/destructive-test-suite.html
```

**Why**: Browsers block cross-origin requests from `file://` protocol for security. The test suite must be served via HTTP to load remote MFE scripts.

### "performance.memory not available"

**Solution**: Run Chrome with `--enable-precise-memory-info` flag

```bash
open -a "Google Chrome" --args --enable-precise-memory-info http://localhost:8080/destructive-test-suite.html
```

### "Container not found"

**Symptom**: `Container 'reactRemote' not found`

**Solution**: Ensure MFE servers are running on correct ports

```bash
# Check if servers are running
curl -I http://localhost:5001/remoteEntry.js  # React Pink
curl -I http://localhost:5002/remoteEntry.js  # React Orange

# If not running, start them
cd react-remote && npm start  # Terminal 1
cd react-orange && npm start  # Terminal 2
```

### "Script failed to load"

**Symptom**: Network error when loading remoteEntry.js

**Solution**: Check CORS headers in MFE server configuration

Both rspack configs should have:
```javascript
devServer: {
  headers: {
    'Access-Control-Allow-Origin': '*',  // ← Required
  },
}
```

### "Tests running indefinitely"

**Symptom**: Tests never complete or hang

**Solution**:
1. Check browser console for JavaScript errors
2. Verify all promises are resolving
3. Check if MFE mount/unmount completes
4. Look for infinite loops in test logic

---

## Best Practices

### Before Release

✅ Run full destructive test suite
✅ Profile memory with 100+ mount/unmount cycles
✅ Test parallel MFE loading
✅ Verify cleanup under rapid switching
✅ Check message flood resilience

### During Development

✅ Run lifecycle tests after MFE changes
✅ Run memory tests after adding subscriptions
✅ Run messaging tests after event bus changes

### In Production

✅ Monitor real user memory profiles
✅ Track MFE mount/unmount metrics
✅ Alert on memory growth anomalies

---

## Related Documentation

- [MODULE_FEDERATION_FUNDAMENTALS.md](MODULE_FEDERATION_FUNDAMENTALS.md) - Core concepts
- [RSPACK_MODULE_FEDERATION_FUNDAMENTALS.md](RSPACK_MODULE_FEDERATION_FUNDAMENTALS.md) - Rspack implementation
- [CLAUDE.md](CLAUDE.md) - Production pitfalls

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | Nov 2025 | Initial destructive test suite |

---

**Maintained By**: Platform Architecture Team
**Last Updated**: November 9, 2025
