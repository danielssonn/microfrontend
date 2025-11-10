/**
 * MFE Telemetry System
 *
 * Provides health monitoring, performance tracking, and memory profiling
 * based on thresholds established during destructive testing.
 */

// Extend Performance interface to include memory property (non-standard, Chrome only)
declare global {
  interface Performance {
    memory?: {
      usedJSHeapSize: number;
      totalJSHeapSize: number;
      jsHeapSizeLimit: number;
    };
  }
}

/**
 * Health status levels
 */
export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  CRITICAL = 'critical'
}

/**
 * Telemetry thresholds based on destructive testing results
 * These values were empirically determined through stress testing
 */
export interface TelemetryThresholds {
  /** Memory growth per mount/unmount cycle */
  memory: {
    /** Normal threshold: 750KB per cycle */
    normal: number;
    /** Warning threshold: 1.0MB per cycle */
    warning: number;
    /** Critical threshold: 1.5MB per cycle */
    critical: number;
  };

  /** Mount/unmount performance */
  performance: {
    /** Normal mount time: <100ms */
    mountTimeNormal: number;
    /** Warning mount time: 100-200ms */
    mountTimeWarning: number;
    /** Critical mount time: >200ms */
    mountTimeCritical: number;

    /** Normal unmount time: <50ms */
    unmountTimeNormal: number;
    /** Warning unmount time: 50-100ms */
    unmountTimeWarning: number;
    /** Critical unmount time: >100ms */
    unmountTimeCritical: number;
  };

  /** Error rate thresholds */
  errors: {
    /** Acceptable error rate: <1% */
    normal: number;
    /** Warning error rate: 1-5% */
    warning: number;
    /** Critical error rate: >5% */
    critical: number;
  };
}

/**
 * Default thresholds from destructive testing
 */
export const DEFAULT_THRESHOLDS: TelemetryThresholds = {
  memory: {
    normal: 750 * 1024,      // 750KB in bytes
    warning: 1024 * 1024,    // 1MB in bytes
    critical: 1.5 * 1024 * 1024  // 1.5MB in bytes
  },
  performance: {
    mountTimeNormal: 100,
    mountTimeWarning: 200,
    mountTimeCritical: 300,
    unmountTimeNormal: 50,
    unmountTimeWarning: 100,
    unmountTimeCritical: 150
  },
  errors: {
    normal: 0.01,    // 1%
    warning: 0.05,   // 5%
    critical: 0.10   // 10%
  }
};

/**
 * Telemetry metric types
 */
export interface TelemetryMetric {
  timestamp: number;
  mfeName: string;
  instanceId: string;
  metricType: 'mount' | 'unmount' | 'error' | 'memory' | 'health';
  value: number;
  metadata?: Record<string, any>;
}

/**
 * Health check result
 */
export interface HealthCheck {
  status: HealthStatus;
  mfeName: string;
  instanceId: string;
  timestamp: number;
  checks: {
    memory: {
      status: HealthStatus;
      current: number;
      threshold: number;
      message: string;
    };
    performance: {
      status: HealthStatus;
      avgMountTime: number;
      avgUnmountTime: number;
      message: string;
    };
    errors: {
      status: HealthStatus;
      errorRate: number;
      totalErrors: number;
      totalOperations: number;
      message: string;
    };
  };
}

/**
 * MFE Telemetry tracker
 */
export class MFETelemetry {
  private mfeName: string;
  private instanceId: string;
  private thresholds: TelemetryThresholds;

  // Metrics storage
  private metrics: TelemetryMetric[] = [];
  private mountTimes: number[] = [];
  private unmountTimes: number[] = [];
  private errors: number = 0;
  private operations: number = 0;
  private memoryAtMount: number = 0;
  private memoryAfterMount: number = 0;
  private memoryAfterUnmount: number = 0;
  private memoryPeak: number = 0;
  private memoryBaseline: number = 0; // Initial memory before first mount

  // Leak detection tracking
  private memoryAfterUnmountHistory: number[] = []; // Track memory after each unmount
  private memoryRetained: number = 0; // Memory not released after unmount

  // Lifecycle tracking
  private mountStartTime: number = 0;
  private mountedAt: number = 0;
  private cycleCount: number = 0;
  private isMounted: boolean = false;

  constructor(
    mfeName: string,
    instanceId: string,
    thresholds: Partial<TelemetryThresholds> = {}
  ) {
    this.mfeName = mfeName;
    this.instanceId = instanceId;
    this.thresholds = this.mergeThresholds(thresholds);
  }

  /**
   * Merge custom thresholds with defaults
   */
  private mergeThresholds(custom: Partial<TelemetryThresholds>): TelemetryThresholds {
    return {
      memory: { ...DEFAULT_THRESHOLDS.memory, ...custom.memory },
      performance: { ...DEFAULT_THRESHOLDS.performance, ...custom.performance },
      errors: { ...DEFAULT_THRESHOLDS.errors, ...custom.errors }
    };
  }

  /**
   * Start tracking mount operation
   */
  startMount(): void {
    this.mountStartTime = performance.now();
    this.operations++;
    this.memoryAtMount = this.getCurrentMemory();

    // Capture baseline on first mount
    if (this.memoryBaseline === 0) {
      this.memoryBaseline = this.memoryAtMount;
      console.log(`[${this.mfeName}] Memory baseline set: ${(this.memoryBaseline / 1024 / 1024).toFixed(2)}MB`);
    }

    this.isMounted = true;
  }

  /**
   * Complete mount tracking
   */
  endMount(): void {
    if (this.mountStartTime === 0) {
      console.warn(`[${this.mfeName}] endMount called without startMount`);
      return;
    }

    const duration = performance.now() - this.mountStartTime;
    this.mountTimes.push(duration);
    this.mountedAt = Date.now();
    this.mountStartTime = 0;

    // Record memory after mount
    this.memoryAfterMount = this.getCurrentMemory();
    if (this.memoryAfterMount > this.memoryPeak) {
      this.memoryPeak = this.memoryAfterMount;
    }

    this.recordMetric({
      timestamp: Date.now(),
      mfeName: this.mfeName,
      instanceId: this.instanceId,
      metricType: 'mount',
      value: duration,
      metadata: {
        cycleCount: this.cycleCount,
        memoryAtMount: this.memoryAtMount,
        memoryAfterMount: this.memoryAfterMount,
        memoryDelta: this.memoryAfterMount - this.memoryAtMount
      }
    });

    console.log(`[${this.mfeName}] Mounted in ${duration.toFixed(2)}ms, memory: ${(this.memoryAfterMount / 1024 / 1024).toFixed(2)}MB`);
  }

  /**
   * Start tracking unmount operation
   */
  startUnmount(): void {
    this.mountStartTime = performance.now(); // Reuse for unmount timing
    this.cycleCount++;
    this.isMounted = false;
  }

  /**
   * Complete unmount tracking
   */
  endUnmount(): void {
    if (this.mountStartTime === 0) {
      console.warn(`[${this.mfeName}] endUnmount called without startUnmount`);
      return;
    }

    const duration = performance.now() - this.mountStartTime;
    this.unmountTimes.push(duration);
    this.mountStartTime = 0;

    // Record memory after unmount
    this.memoryAfterUnmount = this.getCurrentMemory();
    this.memoryAfterUnmountHistory.push(this.memoryAfterUnmount);

    // Calculate memory retained (leaked) after unmount
    // Memory should return close to baseline, excess indicates a leak
    this.memoryRetained = Math.max(0, this.memoryAfterUnmount - this.memoryBaseline);

    this.recordMetric({
      timestamp: Date.now(),
      mfeName: this.mfeName,
      instanceId: this.instanceId,
      metricType: 'unmount',
      value: duration,
      metadata: {
        cycleCount: this.cycleCount,
        memoryAfterUnmount: this.memoryAfterUnmount,
        memoryRetained: this.memoryRetained,
        memoryBaseline: this.memoryBaseline
      }
    });

    console.log(`[${this.mfeName}] Unmounted in ${duration.toFixed(2)}ms, memory: ${(this.memoryAfterUnmount / 1024 / 1024).toFixed(2)}MB, retained: ${(this.memoryRetained / 1024 / 1024).toFixed(2)}MB`);
  }

  /**
   * Record an error
   */
  recordError(error: Error, context?: string): void {
    this.errors++;

    this.recordMetric({
      timestamp: Date.now(),
      mfeName: this.mfeName,
      instanceId: this.instanceId,
      metricType: 'error',
      value: 1,
      metadata: {
        error: error.message,
        stack: error.stack,
        context,
        errorRate: this.getErrorRate()
      }
    });

    console.error(`[${this.mfeName}] Error recorded:`, error, context);
  }

  /**
   * Record current memory usage
   */
  recordMemory(): void {
    const memory = this.getCurrentMemory();

    if (memory > this.memoryPeak) {
      this.memoryPeak = memory;
    }

    this.recordMetric({
      timestamp: Date.now(),
      mfeName: this.mfeName,
      instanceId: this.instanceId,
      metricType: 'memory',
      value: memory,
      metadata: {
        peak: this.memoryPeak,
        cycleCount: this.cycleCount
      }
    });
  }

  /**
   * Get current memory usage
   */
  private getCurrentMemory(): number {
    if (typeof window !== 'undefined' && window.performance?.memory) {
      return window.performance.memory.usedJSHeapSize;
    }
    return 0;
  }

  /**
   * Record a metric
   */
  private recordMetric(metric: TelemetryMetric): void {
    this.metrics.push(metric);

    // Keep only last 1000 metrics to prevent memory bloat
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }
  }

  /**
   * Get error rate
   */
  private getErrorRate(): number {
    return this.operations > 0 ? this.errors / this.operations : 0;
  }

  /**
   * Get average mount time
   */
  private getAvgMountTime(): number {
    if (this.mountTimes.length === 0) return 0;
    return this.mountTimes.reduce((a, b) => a + b, 0) / this.mountTimes.length;
  }

  /**
   * Get average unmount time
   */
  private getAvgUnmountTime(): number {
    if (this.unmountTimes.length === 0) return 0;
    return this.unmountTimes.reduce((a, b) => a + b, 0) / this.unmountTimes.length;
  }

  /**
   * Calculate memory trend (growth over cycles)
   * Returns bytes per cycle - positive means growing leak
   */
  private getMemoryTrend(): number {
    if (this.memoryAfterUnmountHistory.length < 2) return 0;

    // Use linear regression to detect trend
    const n = this.memoryAfterUnmountHistory.length;
    const xSum = (n * (n - 1)) / 2; // Sum of 0,1,2,...,n-1
    const ySum = this.memoryAfterUnmountHistory.reduce((a, b) => a + b, 0);
    const xySum = this.memoryAfterUnmountHistory.reduce((sum, y, x) => sum + x * y, 0);
    const xSquaredSum = (n * (n - 1) * (2 * n - 1)) / 6; // Sum of 0²,1²,2²,...,(n-1)²

    // Slope = (n*xySum - xSum*ySum) / (n*xSquaredSum - xSum²)
    const slope = (n * xySum - xSum * ySum) / (n * xSquaredSum - xSum * xSum);

    return slope;
  }

  /**
   * Detect if there's a memory leak
   */
  private hasMemoryLeak(): boolean {
    // Leak indicators:
    // 1. Memory trend is positive (growing)
    // 2. Retained memory exceeds threshold (5MB)
    const trend = this.getMemoryTrend();
    const leakThreshold = 5 * 1024 * 1024; // 5MB

    return trend > 100 * 1024 || this.memoryRetained > leakThreshold; // 100KB/cycle trend or 5MB retained
  }

  /**
   * Get leak severity rating
   */
  private getLeakSeverity(): 'none' | 'minor' | 'moderate' | 'severe' {
    if (!this.hasMemoryLeak()) return 'none';

    const trend = this.getMemoryTrend();
    const trendKB = trend / 1024;
    const retainedMB = this.memoryRetained / 1024 / 1024;

    // Severe: >500KB/cycle trend or >10MB retained
    if (trendKB > 500 || retainedMB > 10) return 'severe';

    // Moderate: >250KB/cycle trend or >7MB retained
    if (trendKB > 250 || retainedMB > 7) return 'moderate';

    // Minor: any detectable leak
    return 'minor';
  }

  /**
   * Perform health check
   */
  getHealthCheck(): HealthCheck {
    const currentMemory = this.getCurrentMemory();
    const avgMountTime = this.getAvgMountTime();
    const avgUnmountTime = this.getAvgUnmountTime();
    const errorRate = this.getErrorRate();

    // Memory health based on leak detection, not absolute values
    // (absolute memory measures entire browser tab, not individual MFE)
    let memoryStatus = HealthStatus.HEALTHY;
    let memoryMessage = this.isMounted
      ? `Memory: ${(currentMemory / 1024 / 1024).toFixed(2)}MB`
      : 'Not mounted';

    // Check for memory leaks instead of absolute thresholds
    if (this.hasMemoryLeak()) {
      const severity = this.getLeakSeverity();
      const retainedMB = this.memoryRetained / 1024 / 1024;
      const trendMB = this.getMemoryTrend() / 1024 / 1024;

      if (severity === 'severe') {
        memoryStatus = HealthStatus.CRITICAL;
        memoryMessage = `SEVERE LEAK: ${retainedMB.toFixed(2)}MB retained, ${trendMB.toFixed(2)}MB/cycle trend`;
      } else if (severity === 'moderate') {
        memoryStatus = HealthStatus.DEGRADED;
        memoryMessage = `MODERATE LEAK: ${retainedMB.toFixed(2)}MB retained, ${trendMB.toFixed(2)}MB/cycle trend`;
      } else if (severity === 'minor') {
        memoryStatus = HealthStatus.DEGRADED;
        memoryMessage = `Minor leak: ${retainedMB.toFixed(2)}MB retained, ${trendMB.toFixed(2)}MB/cycle trend`;
      }
    }

    // Performance health
    let perfStatus = HealthStatus.HEALTHY;
    let perfMessage = `Mount: ${avgMountTime.toFixed(2)}ms, Unmount: ${avgUnmountTime.toFixed(2)}ms`;

    if (avgMountTime > this.thresholds.performance.mountTimeCritical ||
        avgUnmountTime > this.thresholds.performance.unmountTimeCritical) {
      perfStatus = HealthStatus.CRITICAL;
      perfMessage = `CRITICAL: Mount ${avgMountTime.toFixed(2)}ms, Unmount ${avgUnmountTime.toFixed(2)}ms`;
    } else if (avgMountTime > this.thresholds.performance.mountTimeWarning ||
               avgUnmountTime > this.thresholds.performance.unmountTimeWarning) {
      perfStatus = HealthStatus.DEGRADED;
      perfMessage = `SLOW: Mount ${avgMountTime.toFixed(2)}ms, Unmount ${avgUnmountTime.toFixed(2)}ms`;
    }

    // Error health
    let errorStatus = HealthStatus.HEALTHY;
    let errorMessage = `Error rate: ${(errorRate * 100).toFixed(2)}% (${this.errors}/${this.operations})`;

    if (errorRate > this.thresholds.errors.critical) {
      errorStatus = HealthStatus.CRITICAL;
      errorMessage = `CRITICAL: ${(errorRate * 100).toFixed(2)}% error rate (${this.errors}/${this.operations})`;
    } else if (errorRate > this.thresholds.errors.warning) {
      errorStatus = HealthStatus.DEGRADED;
      errorMessage = `WARNING: ${(errorRate * 100).toFixed(2)}% error rate (${this.errors}/${this.operations})`;
    } else if (errorRate > this.thresholds.errors.normal) {
      errorStatus = HealthStatus.DEGRADED;
      errorMessage = `Elevated: ${(errorRate * 100).toFixed(2)}% error rate (${this.errors}/${this.operations})`;
    }

    // Overall status is the worst of all checks
    const overallStatus = [memoryStatus, perfStatus, errorStatus]
      .sort((a, b) => {
        const order = [HealthStatus.CRITICAL, HealthStatus.UNHEALTHY, HealthStatus.DEGRADED, HealthStatus.HEALTHY];
        return order.indexOf(a) - order.indexOf(b);
      })[0];

    return {
      status: overallStatus,
      mfeName: this.mfeName,
      instanceId: this.instanceId,
      timestamp: Date.now(),
      checks: {
        memory: {
          status: memoryStatus,
          current: currentMemory,
          threshold: 30 * 1024 * 1024, // 30MB threshold in bytes
          message: memoryMessage
        },
        performance: {
          status: perfStatus,
          avgMountTime,
          avgUnmountTime,
          message: perfMessage
        },
        errors: {
          status: errorStatus,
          errorRate,
          totalErrors: this.errors,
          totalOperations: this.operations,
          message: errorMessage
        }
      }
    };
  }

  /**
   * Get all metrics
   */
  getMetrics(): TelemetryMetric[] {
    return [...this.metrics];
  }

  /**
   * Get metrics summary
   */
  getSummary() {
    const healthCheck = this.getHealthCheck();
    const currentMemory = this.getCurrentMemory();

    return {
      mfeName: this.mfeName,
      instanceId: this.instanceId,
      status: healthCheck.status,
      uptime: this.mountedAt > 0 ? Date.now() - this.mountedAt : 0,
      cycles: this.cycleCount,
      operations: this.operations,
      errors: this.errors,
      errorRate: this.getErrorRate(),
      isMounted: this.isMounted,
      performance: {
        avgMountTime: this.getAvgMountTime(),
        avgUnmountTime: this.getAvgUnmountTime(),
        lastMountTime: this.mountTimes[this.mountTimes.length - 1] || 0,
        lastUnmountTime: this.unmountTimes[this.unmountTimes.length - 1] || 0
      },
      memory: {
        // Absolute measurements
        baseline: this.memoryBaseline,
        baselineMB: this.memoryBaseline / 1024 / 1024,
        current: this.isMounted ? currentMemory : 0,
        currentMB: this.isMounted ? currentMemory / 1024 / 1024 : 0,
        afterMount: this.memoryAfterMount,
        afterMountMB: this.memoryAfterMount / 1024 / 1024,
        afterUnmount: this.memoryAfterUnmount,
        afterUnmountMB: this.memoryAfterUnmount / 1024 / 1024,
        peak: this.memoryPeak,
        peakMB: this.memoryPeak / 1024 / 1024,

        // Delta measurements
        mountDelta: this.memoryAfterMount - this.memoryAtMount,
        mountDeltaMB: (this.memoryAfterMount - this.memoryAtMount) / 1024 / 1024,

        // Leak detection
        retained: this.memoryRetained,
        retainedMB: this.memoryRetained / 1024 / 1024,
        trend: this.getMemoryTrend(),
        trendMB: this.getMemoryTrend() / 1024 / 1024,
        hasLeak: this.hasMemoryLeak(),
        leakSeverity: this.getLeakSeverity()
      },
      health: healthCheck
    };
  }

  /**
   * Export metrics as JSON
   */
  exportMetrics(): string {
    return JSON.stringify({
      summary: this.getSummary(),
      metrics: this.metrics
    }, null, 2);
  }

  /**
   * Clear all metrics (useful for testing)
   */
  reset(): void {
    this.metrics = [];
    this.mountTimes = [];
    this.unmountTimes = [];
    this.errors = 0;
    this.operations = 0;
    this.cycleCount = 0;
    this.memoryAtMount = 0;
    this.memoryAfterMount = 0;
    this.memoryAfterUnmount = 0;
    this.memoryPeak = 0;
    this.memoryBaseline = 0;
    this.memoryAfterUnmountHistory = [];
    this.memoryRetained = 0;
    this.isMounted = false;

    console.log(`[${this.mfeName}] Telemetry reset`);
  }
}

/**
 * Global telemetry registry
 * Allows accessing telemetry from anywhere in the application
 */
class TelemetryRegistry {
  private telemetry = new Map<string, MFETelemetry>();
  private telemetryByMfeName = new Map<string, MFETelemetry>();

  register(instanceId: string, telemetry: MFETelemetry): void {
    this.telemetry.set(instanceId, telemetry);
    console.log(`[TelemetryRegistry] Registered instance: ${instanceId}`, {
      totalInstances: this.telemetry.size,
      allInstanceIds: Array.from(this.telemetry.keys()),
      registryRef: this
    });
  }

  unregister(instanceId: string): void {
    const existed = this.telemetry.has(instanceId);
    this.telemetry.delete(instanceId);
    console.log(`[TelemetryRegistry] Unregistered instance: ${instanceId}`, {
      existed,
      totalInstances: this.telemetry.size,
      remainingInstanceIds: Array.from(this.telemetry.keys()),
      registryRef: this
    });
  }

  /**
   * Get or create persistent telemetry for an MFE name
   * This allows telemetry to persist across instance remounts
   */
  getOrCreatePersistentTelemetry(mfeName: string, instanceId: string): MFETelemetry {
    let telemetry = this.telemetryByMfeName.get(mfeName);

    if (!telemetry) {
      // Create new telemetry for this MFE
      telemetry = new MFETelemetry(mfeName, instanceId);
      this.telemetryByMfeName.set(mfeName, telemetry);
      console.log(`[TelemetryRegistry] Created persistent telemetry for ${mfeName}`);
    } else {
      console.log(`[TelemetryRegistry] Reusing persistent telemetry for ${mfeName}`, {
        previousCycles: (telemetry as any).cycleCount,
        newInstanceId: instanceId
      });
    }

    return telemetry;
  }

  get(instanceId: string): MFETelemetry | undefined {
    return this.telemetry.get(instanceId);
  }

  getAll(): MFETelemetry[] {
    const all = Array.from(this.telemetry.values());
    console.log(`[TelemetryRegistry] getAll() called`, {
      count: all.length,
      instanceIds: Array.from(this.telemetry.keys()),
      registryRef: this
    });
    return all;
  }

  getAllHealthChecks(): HealthCheck[] {
    return this.getAll().map(t => t.getHealthCheck());
  }

  getOverallHealth(): HealthStatus {
    const checks = this.getAllHealthChecks();
    if (checks.length === 0) return HealthStatus.HEALTHY;

    const statuses = checks.map(c => c.status);
    const order = [HealthStatus.CRITICAL, HealthStatus.UNHEALTHY, HealthStatus.DEGRADED, HealthStatus.HEALTHY];

    return statuses.sort((a, b) => order.indexOf(a) - order.indexOf(b))[0];
  }
}

// Export singleton registry
export const telemetryRegistry = new TelemetryRegistry();

// Extend Window interface for TypeScript
declare global {
  interface Window {
    __MFE_TELEMETRY__?: TelemetryRegistry;
  }
}

// Make registry available globally for debugging
if (typeof window !== 'undefined') {
  // Only set if not already set (avoid overwriting existing registry)
  if (!window.__MFE_TELEMETRY__) {
    window.__MFE_TELEMETRY__ = telemetryRegistry;
    console.log('[TelemetryRegistry] Global registry initialized on window', {
      registryRef: telemetryRegistry,
      windowRef: window
    });
  } else {
    console.log('[TelemetryRegistry] Global registry already exists on window, reusing it', {
      existingRegistryRef: window.__MFE_TELEMETRY__,
      localRegistryRef: telemetryRegistry,
      areTheSame: window.__MFE_TELEMETRY__ === telemetryRegistry
    });
  }
}
