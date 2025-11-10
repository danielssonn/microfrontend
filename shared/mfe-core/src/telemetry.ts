/**
 * MFE Telemetry System
 *
 * Provides health monitoring, performance tracking, and memory profiling
 * based on thresholds established during destructive testing.
 */

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
  private memoryBaseline: number = 0;
  private memoryPeak: number = 0;

  // Lifecycle tracking
  private mountStartTime: number = 0;
  private mountedAt: number = 0;
  private cycleCount: number = 0;

  constructor(
    mfeName: string,
    instanceId: string,
    thresholds: Partial<TelemetryThresholds> = {}
  ) {
    this.mfeName = mfeName;
    this.instanceId = instanceId;
    this.thresholds = this.mergeThresholds(thresholds);

    // Record memory baseline
    this.recordMemoryBaseline();
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
   * Record memory baseline on initialization
   */
  private recordMemoryBaseline(): void {
    if (typeof window !== 'undefined' && window.performance?.memory) {
      this.memoryBaseline = window.performance.memory.usedJSHeapSize;
      this.memoryPeak = this.memoryBaseline;
    }
  }

  /**
   * Start tracking mount operation
   */
  startMount(): void {
    this.mountStartTime = performance.now();
    this.operations++;
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

    this.recordMetric({
      timestamp: Date.now(),
      mfeName: this.mfeName,
      instanceId: this.instanceId,
      metricType: 'mount',
      value: duration,
      metadata: {
        cycleCount: this.cycleCount
      }
    });

    console.log(`[${this.mfeName}] Mounted in ${duration.toFixed(2)}ms`);
  }

  /**
   * Start tracking unmount operation
   */
  startUnmount(): void {
    this.mountStartTime = performance.now(); // Reuse for unmount timing
    this.cycleCount++;
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
    this.recordMemory();

    this.recordMetric({
      timestamp: Date.now(),
      mfeName: this.mfeName,
      instanceId: this.instanceId,
      metricType: 'unmount',
      value: duration,
      metadata: {
        cycleCount: this.cycleCount,
        memory: this.getCurrentMemory()
      }
    });

    console.log(`[${this.mfeName}] Unmounted in ${duration.toFixed(2)}ms`);
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
        baseline: this.memoryBaseline,
        peak: this.memoryPeak,
        growth: memory - this.memoryBaseline,
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
   * Get memory growth per cycle
   */
  private getMemoryPerCycle(): number {
    if (this.cycleCount === 0) return 0;
    const currentMemory = this.getCurrentMemory();
    const growth = currentMemory - this.memoryBaseline;
    return growth / this.cycleCount;
  }

  /**
   * Perform health check
   */
  getHealthCheck(): HealthCheck {
    const memoryPerCycle = this.getMemoryPerCycle();
    const avgMountTime = this.getAvgMountTime();
    const avgUnmountTime = this.getAvgUnmountTime();
    const errorRate = this.getErrorRate();

    // Memory health
    let memoryStatus = HealthStatus.HEALTHY;
    let memoryMessage = `Memory growth: ${(memoryPerCycle / 1024).toFixed(2)}KB/cycle`;

    if (memoryPerCycle > this.thresholds.memory.critical) {
      memoryStatus = HealthStatus.CRITICAL;
      memoryMessage = `CRITICAL: ${(memoryPerCycle / 1024).toFixed(2)}KB/cycle (threshold: ${(this.thresholds.memory.critical / 1024).toFixed(0)}KB)`;
    } else if (memoryPerCycle > this.thresholds.memory.warning) {
      memoryStatus = HealthStatus.DEGRADED;
      memoryMessage = `WARNING: ${(memoryPerCycle / 1024).toFixed(2)}KB/cycle (threshold: ${(this.thresholds.memory.warning / 1024).toFixed(0)}KB)`;
    } else if (memoryPerCycle > this.thresholds.memory.normal) {
      memoryStatus = HealthStatus.DEGRADED;
      memoryMessage = `Elevated: ${(memoryPerCycle / 1024).toFixed(2)}KB/cycle (threshold: ${(this.thresholds.memory.normal / 1024).toFixed(0)}KB)`;
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
          current: memoryPerCycle,
          threshold: this.thresholds.memory.normal,
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

    return {
      mfeName: this.mfeName,
      instanceId: this.instanceId,
      status: healthCheck.status,
      uptime: this.mountedAt > 0 ? Date.now() - this.mountedAt : 0,
      cycles: this.cycleCount,
      operations: this.operations,
      errors: this.errors,
      errorRate: this.getErrorRate(),
      performance: {
        avgMountTime: this.getAvgMountTime(),
        avgUnmountTime: this.getAvgUnmountTime(),
        lastMountTime: this.mountTimes[this.mountTimes.length - 1] || 0,
        lastUnmountTime: this.unmountTimes[this.unmountTimes.length - 1] || 0
      },
      memory: {
        baseline: this.memoryBaseline,
        current: this.getCurrentMemory(),
        peak: this.memoryPeak,
        growth: this.getCurrentMemory() - this.memoryBaseline,
        perCycle: this.getMemoryPerCycle()
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
    this.recordMemoryBaseline();

    console.log(`[${this.mfeName}] Telemetry reset`);
  }
}

/**
 * Global telemetry registry
 * Allows accessing telemetry from anywhere in the application
 */
class TelemetryRegistry {
  private telemetry = new Map<string, MFETelemetry>();

  register(instanceId: string, telemetry: MFETelemetry): void {
    this.telemetry.set(instanceId, telemetry);
  }

  unregister(instanceId: string): void {
    this.telemetry.delete(instanceId);
  }

  get(instanceId: string): MFETelemetry | undefined {
    return this.telemetry.get(instanceId);
  }

  getAll(): MFETelemetry[] {
    return Array.from(this.telemetry.values());
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
  window.__MFE_TELEMETRY__ = telemetryRegistry;
}
