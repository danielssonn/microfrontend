import { Component, OnInit, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-telemetry-viewer',
  template: `
    <div class="telemetry-viewer">
      <h3>MFE Telemetry</h3>
      <div *ngIf="!registryAvailable" class="no-registry">
        <p>Telemetry registry not available</p>
      </div>
      <div *ngIf="registryAvailable">
        <div class="overall-health">
          <strong>Overall Health:</strong>
          <span [class]="'status-' + overallHealth">{{ overallHealth }}</span>
        </div>
        <div class="instances">
          <h4>Active Instances: {{ instances.length }}</h4>
          <div *ngFor="let instance of instances" class="instance-card">
            <div class="instance-header">
              <strong>{{ instance.mfeName }}</strong>
              <span [class]="'status-' + instance.status">{{ instance.status }}</span>
            </div>
            <div class="instance-metrics">
              <div class="metric">
                <label>Uptime:</label>
                <span>{{ formatDuration(instance.uptime) }}</span>
              </div>
              <div class="metric">
                <label>Cycles:</label>
                <span>{{ instance.cycles }}</span>
              </div>
              <div class="metric">
                <label>Mount Time:</label>
                <span>{{ instance.performance.avgMountTime.toFixed(0) }}ms</span>
              </div>
              <div class="metric">
                <label>Error Rate:</label>
                <span>{{ formatPercent(instance.errorRate) }}</span>
              </div>
              <div class="metric">
                <label>Baseline:</label>
                <span>{{ formatBytes(instance.memory.baseline) }}</span>
              </div>
              <div class="metric">
                <label>Current:</label>
                <span>{{ instance.isMounted ? formatBytes(instance.memory.current) : 'Not mounted' }}</span>
              </div>
              <div class="metric">
                <label>Peak:</label>
                <span>{{ formatBytes(instance.memory.peak) }}</span>
              </div>
              <div class="metric">
                <label>Delta:</label>
                <span>{{ formatBytes(instance.memory.mountDelta) }}</span>
              </div>
              <div class="metric">
                <label>Retained:</label>
                <span [class.leak-warning]="instance.memory.hasLeak">
                  {{ formatBytes(instance.memory.retained) }}
                  <span *ngIf="instance.memory.hasLeak" class="leak-indicator">
                    ({{ instance.memory.leakSeverity }})
                  </span>
                </span>
              </div>
              <div class="metric">
                <label>Trend:</label>
                <span [class.leak-warning]="instance.memory.trendMB > 0.1">
                  {{ formatTrend(instance.memory.trendMB) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .telemetry-viewer {
      padding: 20px;
      background: #f5f5f5;
      border-radius: 8px;
      margin-top: 20px;
    }
    .telemetry-viewer h3 {
      margin-top: 0;
    }
    .overall-health {
      padding: 10px;
      background: white;
      border-radius: 4px;
      margin-bottom: 15px;
    }
    .status-healthy { color: #10b981; font-weight: bold; }
    .status-degraded { color: #f59e0b; font-weight: bold; }
    .status-critical { color: #ef4444; font-weight: bold; }
    .instances h4 {
      margin-bottom: 10px;
    }
    .instance-card {
      background: white;
      padding: 15px;
      border-radius: 4px;
      margin-bottom: 10px;
      border-left: 4px solid #60a5fa;
    }
    .instance-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
    }
    .instance-metrics {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    }
    .metric {
      font-size: 12px;
    }
    .metric label {
      font-weight: bold;
      margin-right: 5px;
    }
    .leak-warning {
      color: #f59e0b;
      font-weight: bold;
    }
    .leak-indicator {
      font-size: 10px;
      text-transform: uppercase;
      padding: 2px 4px;
      background: #fef3c7;
      border-radius: 3px;
    }
    .no-registry {
      padding: 20px;
      background: #fee;
      color: #c00;
      border-radius: 4px;
    }
  `]
})
export class TelemetryViewerComponent implements OnInit, OnDestroy {
  registryAvailable = false;
  overallHealth = 'unknown';
  instances: any[] = [];
  private intervalId?: number;

  ngOnInit() {
    this.updateTelemetry();
    // Refresh every 500ms for more responsive updates during MFE switches
    this.intervalId = window.setInterval(() => this.updateTelemetry(), 500);
  }

  ngOnDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  updateTelemetry() {
    const registry = (window as any).__MFE_TELEMETRY__;

    if (!registry) {
      this.registryAvailable = false;
      console.warn('[Telemetry Viewer] Registry not available on window', {
        windowRef: window,
        windowKeys: Object.keys(window).filter(k => k.includes('MFE'))
      });
      return;
    }

    this.registryAvailable = true;
    this.overallHealth = registry.getOverallHealth();

    const allTelemetry = registry.getAll();
    this.instances = allTelemetry.map((t: any) => t.getSummary());

    console.log('[Telemetry Viewer] Updated:', {
      registryRef: registry,
      windowRef: window,
      instanceCount: this.instances.length,
      instances: this.instances.map(i => ({ name: i.mfeName, id: i.id }))
    });
  }

  formatDuration(ms: number): string {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  formatPercent(decimal: number): string {
    return `${(decimal * 100).toFixed(2)}%`;
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  formatTrend(trendMB: number): string {
    if (Math.abs(trendMB) < 0.01) return '0 MB/cycle';
    const sign = trendMB > 0 ? '+' : '';
    return `${sign}${trendMB.toFixed(2)} MB/cycle`;
  }
}
