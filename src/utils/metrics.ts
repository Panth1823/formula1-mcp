/**
 * Basic metrics collection for Prometheus
 * Simple in-memory metrics (can be upgraded to Prometheus client library)
 */

import { config } from '../config/index.js';

interface MetricValue {
  value: number;
  labels?: Record<string, string>;
}

class MetricsCollector {
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();

  // Counter metrics
  incrementCounter(name: string, labels?: Record<string, string>): void {
    const key = this.getKey(name, labels);
    this.counters.set(key, (this.counters.get(key) || 0) + 1);
  }

  // Gauge metrics
  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getKey(name, labels);
    this.gauges.set(key, value);
  }

  // Histogram metrics
  observeHistogram(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getKey(name, labels);
    const values = this.histograms.get(key) || [];
    values.push(value);
    this.histograms.set(key, values);
  }

  private getKey(name: string, labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return name;
    }
    const labelStr = Object.entries(labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return `${name}{${labelStr}}`;
  }

  // Export metrics in Prometheus format
  exportPrometheus(): string {
    const lines: string[] = [];

    // Export counters
    for (const [key, value] of this.counters.entries()) {
      lines.push(`# TYPE ${key.split('{')[0]} counter`);
      lines.push(`${key} ${value}`);
    }

    // Export gauges
    for (const [key, value] of this.gauges.entries()) {
      lines.push(`# TYPE ${key.split('{')[0]} gauge`);
      lines.push(`${key} ${value}`);
    }

    // Export histograms (simplified - just count and sum)
    for (const [key, values] of this.histograms.entries()) {
      const baseName = key.split('{')[0];
      const sum = values.reduce((a, b) => a + b, 0);
      const count = values.length;
      const avg = count > 0 ? sum / count : 0;

      lines.push(`# TYPE ${baseName} histogram`);
      lines.push(`${baseName}_sum${key.includes('{') ? '{' + key.split('{')[1] : ''} ${sum}`);
      lines.push(`${baseName}_count${key.includes('{') ? '{' + key.split('{')[1] : ''} ${count}`);
      lines.push(`${baseName}_avg${key.includes('{') ? '{' + key.split('{')[1] : ''} ${avg}`);
    }

    return lines.join('\n') + '\n';
  }

  // Reset all metrics
  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }
}

export const metrics = new MetricsCollector();

// Helper middleware to track request metrics
export function trackRequestMetrics(req: any, res: any, next: any): void {
  if (!config.metricsEnabled) {
    return next();
  }

  const startTime = Date.now();
  const method = req.method;
  const path = req.path;

  // Track request count
  metrics.incrementCounter('http_requests_total', { method, path });

  // Track response time
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    metrics.observeHistogram('http_request_duration_ms', duration, { method, path });
    metrics.incrementCounter('http_responses_total', {
      method,
      path,
      status: res.statusCode.toString(),
    });
  });

  next();
}

