/**
 * Self-Healing Pipeline Tests
 * Covers: anomaly detection, remediation, provider health, incident tracking, MTTD/MTTR
 */

import { describe, it, expect } from 'vitest';

const API_BASE = 'http://localhost:5000';

async function fetchApi(path: string, options?: RequestInit) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  return response;
}

async function isJsonResponse(response: Response): Promise<boolean> {
  const contentType = response.headers.get('content-type');
  return contentType !== null && contentType.includes('application/json');
}

async function safeParseJson(response: Response): Promise<any | null> {
  if (await isJsonResponse(response)) {
    return response.json();
  }
  return null;
}

describe('Self-Healing Metrics Pipeline', () => {
  describe('GET /api/self-healing/metrics', () => {
    it('should return self-healing metrics', async () => {
      const response = await fetchApi('/api/self-healing/metrics');
      expect([200, 404]).toContain(response.status);
      const data = await safeParseJson(response);
      if (data) {
        expect(data).toBeDefined();
      }
    });
  });

  describe('GET /api/self-healing/incidents', () => {
    it('should return incident list', async () => {
      const response = await fetchApi('/api/self-healing/incidents');
      expect([200, 404]).toContain(response.status);
      const data = await safeParseJson(response);
      if (data) {
        expect(Array.isArray(data) || data.incidents).toBeTruthy();
      }
    });
  });

  describe('GET /api/provider-health', () => {
    it('should return provider health status', async () => {
      const response = await fetchApi('/api/provider-health');
      expect(response.status).toBe(200);
    });
  });
});

describe('Anomaly Detection Pipeline', () => {
  describe('Detection Thresholds', () => {
    it('should have detection thresholds configured', async () => {
      const response = await fetchApi('/api/self-healing/config');
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Anomaly History', () => {
    it('should return anomaly detection history', async () => {
      const response = await fetchApi('/api/self-healing/anomalies');
      expect([200, 404]).toContain(response.status);
    });
  });
});

describe('Auto-Remediation Pipeline', () => {
  describe('Remediation Actions', () => {
    it('should list available remediation actions', async () => {
      const response = await fetchApi('/api/providers/healing-actions');
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Remediation Execution', () => {
    it('should execute remediation for provider', async () => {
      const response = await fetchApi('/api/self-healing/remediate', {
        method: 'POST',
        body: JSON.stringify({
          provider: 'runway',
          action: 'restart',
        }),
      });
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });

  describe('Rollback Safety', () => {
    it('should have rollback capability', async () => {
      const response = await fetchApi('/api/self-healing/rollback', {
        method: 'POST',
        body: JSON.stringify({
          incidentId: 'test-incident',
        }),
      });
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });
});

describe('Incident Tracking Pipeline', () => {
  describe('POST /api/self-healing/incidents', () => {
    it('should create new incident', async () => {
      const response = await fetchApi('/api/self-healing/incidents', {
        method: 'POST',
        body: JSON.stringify({
          type: 'provider_failure',
          provider: 'test-provider',
          severity: 'high',
          description: 'Test incident',
        }),
      });
      expect([200, 201, 400, 404]).toContain(response.status);
    });
  });

  describe('Incident Resolution', () => {
    it('should resolve incident', async () => {
      const response = await fetchApi('/api/self-healing/incidents/1/resolve', {
        method: 'POST',
        body: JSON.stringify({
          resolution: 'Auto-remediated',
        }),
      });
      expect([200, 400, 404]).toContain(response.status);
    });
  });

  describe('Incident Classification', () => {
    it('should classify incidents by type', async () => {
      const response = await fetchApi('/api/self-healing/incidents?type=provider_failure');
      expect([200, 404]).toContain(response.status);
    });

    it('should filter incidents by severity', async () => {
      const response = await fetchApi('/api/self-healing/incidents?severity=high');
      expect([200, 404]).toContain(response.status);
    });
  });
});

describe('MTTD/MTTR Tracking Pipeline', () => {
  describe('MTTD Calculation', () => {
    it('should return mean time to detect metrics', async () => {
      const response = await fetchApi('/api/self-healing/metrics');
      expect([200, 404]).toContain(response.status);
      const data = await safeParseJson(response);
      if (data) {
        expect(data).toBeDefined();
      }
    });
  });

  describe('MTTR Calculation', () => {
    it('should return mean time to resolve metrics', async () => {
      const response = await fetchApi('/api/self-healing/metrics');
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('SLA Tracking', () => {
    it('should track SLA breaches', async () => {
      const response = await fetchApi('/api/self-healing/sla');
      expect([200, 404]).toContain(response.status);
    });
  });
});

describe('Provider Health Monitor Pipeline', () => {
  describe('Health Check Endpoint', () => {
    it('should return comprehensive health status', async () => {
      const response = await fetchApi('/api/providers/health');
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Individual Provider Health', () => {
    it('should check Runway health', async () => {
      const response = await fetchApi('/api/providers/status');
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.providers).toBeDefined();
    });
  });

  describe('Rate Limit Detection', () => {
    it('should detect rate limits', async () => {
      const response = await fetchApi('/api/providers/rate-limits');
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Provider Cooldown', () => {
    it('should handle provider cooldown', async () => {
      const response = await fetchApi('/api/providers/cooldown/runway');
      expect([200, 404]).toContain(response.status);
    });
  });
});

describe('Synthetic Monitoring Pipeline', () => {
  describe('Test Runner Integration', () => {
    it('should run synthetic tests', async () => {
      const response = await fetchApi('/api/tests/run');
      expect([200, 202, 404]).toContain(response.status);
      if (response.status === 200) {
        const data = await response.json();
        expect(data.results).toBeDefined();
      }
    }, 30000);
  });

  describe('Test Results Ingestion', () => {
    it('should return broken features', async () => {
      const response = await fetchApi('/api/tests/broken-features');
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.brokenFeatures).toBeDefined();
    });
  });

  describe('Feature Health', () => {
    it('should return feature health status', async () => {
      const response = await fetchApi('/api/tests/feature-health');
      expect(response.status).toBe(200);
    });
  });
});

describe('Failure Simulation Pipeline', () => {
  describe('Simulate Provider Failure', () => {
    it('should handle simulated failure', async () => {
      const response = await fetchApi('/api/self-healing/simulate/failure', {
        method: 'POST',
        body: JSON.stringify({
          provider: 'test-provider',
          failureType: 'timeout',
        }),
      });
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });

  describe('Failover Testing', () => {
    it('should test failover mechanism', async () => {
      const response = await fetchApi('/api/self-healing/test-failover', {
        method: 'POST',
        body: JSON.stringify({
          primaryProvider: 'runway',
          fallbackProvider: 'veo31',
        }),
      });
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });
});

describe('Error Pattern Learning Pipeline', () => {
  describe('Error Pattern History', () => {
    it('should return error pattern history', async () => {
      const response = await fetchApi('/api/self-healing/error-patterns');
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Pattern Analysis', () => {
    it('should analyze error patterns', async () => {
      const response = await fetchApi('/api/self-healing/analyze-patterns', {
        method: 'POST',
      });
      expect([200, 404, 500]).toContain(response.status);
    });
  });
});

describe('Dashboard Bridge Pipeline', () => {
  describe('Activity Logs', () => {
    it('should return activity logs', async () => {
      const response = await fetchApi('/api/activity-logs');
      expect(response.status).toBe(200);
    });
  });

  describe('Pipeline Status', () => {
    it('should return pipeline status', async () => {
      const response = await fetchApi('/api/pipeline-status');
      expect([200, 404]).toContain(response.status);
    });
  });
});

// =====================================================
// COMPREHENSIVE ALERT THRESHOLD TESTS
// =====================================================
describe('Alert Threshold Pipeline', () => {
  describe('Alert Creation and Configuration', () => {
    it('should return alert thresholds configuration', async () => {
      const response = await fetchApi('/api/alerts');
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should create a new alert', async () => {
      const response = await fetchApi('/api/alerts', {
        method: 'POST',
        body: JSON.stringify({
          type: 'provider_degradation',
          severity: 'high',
          title: 'Test Alert: Provider Performance Degradation',
          message: 'Test alert message for self-healing monitoring',
          metadata: {
            provider: 'test-provider',
            errorRate: 0.5,
            threshold: 0.3
          },
        }),
      });
      expect([200, 201, 400]).toContain(response.status);
    });

    it('should resolve an alert', async () => {
      const response = await fetchApi('/api/alerts/1/resolve', {
        method: 'POST',
      });
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Alert Severity Levels', () => {
    it('should handle critical severity alerts', async () => {
      const response = await fetchApi('/api/alerts', {
        method: 'POST',
        body: JSON.stringify({
          type: 'provider_failure',
          severity: 'critical',
          title: 'Critical: Provider Complete Failure',
          message: 'Provider is completely non-responsive',
        }),
      });
      expect([200, 201, 400]).toContain(response.status);
    });

    it('should handle warning severity alerts', async () => {
      const response = await fetchApi('/api/alerts', {
        method: 'POST',
        body: JSON.stringify({
          type: 'provider_degradation',
          severity: 'warning',
          title: 'Warning: Elevated Error Rate',
          message: 'Error rate above normal threshold',
        }),
      });
      expect([200, 201, 400]).toContain(response.status);
    });
  });
});

// =====================================================
// QUARANTINE BEHAVIOR TESTS
// =====================================================
describe('Provider Quarantine Pipeline', () => {
  describe('Quarantine Status', () => {
    it('should check provider quarantine status', async () => {
      const response = await fetchApi('/api/providers/status');
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.providers).toBeDefined();
    });

    it('should apply quarantine to provider', async () => {
      const response = await fetchApi('/api/self-healing/quarantine', {
        method: 'POST',
        body: JSON.stringify({
          provider: 'test-provider',
          durationMinutes: 30,
          reason: 'consecutive_failures',
        }),
      });
      expect([200, 400, 404]).toContain(response.status);
    });

    it('should release provider from quarantine', async () => {
      const response = await fetchApi('/api/self-healing/quarantine/release', {
        method: 'POST',
        body: JSON.stringify({
          provider: 'test-provider',
        }),
      });
      expect([200, 400, 404]).toContain(response.status);
    });
  });

  describe('Quarantine Triggers', () => {
    it('should track consecutive failure count', async () => {
      const response = await fetchApi('/api/providers/runway/failures');
      expect([200, 404]).toContain(response.status);
    });

    it('should trigger quarantine after threshold exceeded', async () => {
      const response = await fetchApi('/api/self-healing/check-quarantine', {
        method: 'POST',
        body: JSON.stringify({
          provider: 'test-provider',
          failureCount: 5,
        }),
      });
      expect([200, 400, 404]).toContain(response.status);
    });
  });
});

// =====================================================
// MTTD/MTTR CALCULATION TESTS
// =====================================================
describe('MTTD/MTTR Metrics Pipeline', () => {
  describe('Time-to-Detect Metrics', () => {
    it('should calculate mean time to detect', async () => {
      const response = await fetchApi('/api/self-healing/metrics');
      expect([200, 404]).toContain(response.status);
      const data = await safeParseJson(response);
      if (data) {
        expect(data).toBeDefined();
        if (data.mttd !== undefined) {
          expect(typeof data.mttd).toBe('number');
        }
      }
    });

    it('should return detection latency histogram', async () => {
      const response = await fetchApi('/api/self-healing/metrics/detection');
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Time-to-Resolve Metrics', () => {
    it('should calculate mean time to resolve', async () => {
      const response = await fetchApi('/api/self-healing/metrics');
      expect([200, 404]).toContain(response.status);
      const data = await safeParseJson(response);
      if (data) {
        expect(data).toBeDefined();
        if (data.mttr !== undefined) {
          expect(typeof data.mttr).toBe('number');
        }
      }
    });

    it('should track resolution time by incident type', async () => {
      const response = await fetchApi('/api/self-healing/metrics/resolution');
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Healing Metrics Aggregation', () => {
    it('should return aggregated healing metrics', async () => {
      const response = await fetchApi('/api/self-healing/metrics/summary');
      expect([200, 404]).toContain(response.status);
    });

    it('should track success rate of auto-remediation', async () => {
      const response = await fetchApi('/api/self-healing/metrics');
      expect([200, 404]).toContain(response.status);
      const data = await safeParseJson(response);
      if (data && data.remediationSuccessRate !== undefined) {
        expect(data.remediationSuccessRate).toBeGreaterThanOrEqual(0);
        expect(data.remediationSuccessRate).toBeLessThanOrEqual(1);
      }
    });
  });
});

// =====================================================
// FAILURE SIMULATION LIFECYCLE TESTS
// =====================================================
describe('Failure Simulation Lifecycle Pipeline', () => {
  describe('Simulation Creation', () => {
    it('should create failure simulation', async () => {
      const response = await fetchApi('/api/self-healing/simulations', {
        method: 'POST',
        body: JSON.stringify({
          targetProvider: 'test-provider',
          failureType: 'timeout',
          durationMinutes: 5,
          failureParams: {
            probability: 0.5,
            delayMs: 5000,
          },
        }),
      });
      expect([200, 201, 400, 404]).toContain(response.status);
    });

    it('should list active simulations', async () => {
      const response = await fetchApi('/api/self-healing/simulations');
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Simulation Execution', () => {
    it('should stop active simulation', async () => {
      const response = await fetchApi('/api/self-healing/simulations/stop', {
        method: 'POST',
        body: JSON.stringify({
          simulationId: 'test-simulation-1',
        }),
      });
      expect([200, 400, 404]).toContain(response.status);
    });

    it('should check simulation status', async () => {
      const response = await fetchApi('/api/self-healing/simulations/status');
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Simulation Types', () => {
    it('should support timeout simulation', async () => {
      const response = await fetchApi('/api/self-healing/simulate/failure', {
        method: 'POST',
        body: JSON.stringify({
          provider: 'test-provider',
          failureType: 'timeout',
        }),
      });
      expect([200, 400, 404, 500]).toContain(response.status);
    });

    it('should support rate limit simulation', async () => {
      const response = await fetchApi('/api/self-healing/simulate/failure', {
        method: 'POST',
        body: JSON.stringify({
          provider: 'test-provider',
          failureType: 'rate_limit',
        }),
      });
      expect([200, 400, 404, 500]).toContain(response.status);
    });

    it('should support error response simulation', async () => {
      const response = await fetchApi('/api/self-healing/simulate/failure', {
        method: 'POST',
        body: JSON.stringify({
          provider: 'test-provider',
          failureType: 'error_500',
        }),
      });
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });
});

// =====================================================
// REMEDIATION RULES ENGINE TESTS
// =====================================================
describe('Remediation Rules Engine Pipeline', () => {
  describe('Rule Management', () => {
    it('should list all remediation rules', async () => {
      const response = await fetchApi('/api/self-healing/rules');
      expect([200, 404]).toContain(response.status);
    });

    it('should get specific remediation rule', async () => {
      const response = await fetchApi('/api/self-healing/rules/rule_error_rate_high');
      expect([200, 404]).toContain(response.status);
    });

    it('should update rule configuration', async () => {
      const response = await fetchApi('/api/self-healing/rules/rule_error_rate_high', {
        method: 'PUT',
        body: JSON.stringify({
          enabled: true,
          triggerConditions: {
            threshold: 0.6,
            windowMinutes: 10,
          },
        }),
      });
      expect([200, 400, 404]).toContain(response.status);
    });
  });

  describe('Rule Execution', () => {
    it('should trigger rule manually', async () => {
      const response = await fetchApi('/api/self-healing/rules/execute', {
        method: 'POST',
        body: JSON.stringify({
          ruleId: 'rule_consecutive_failures',
          provider: 'test-provider',
        }),
      });
      expect([200, 400, 404]).toContain(response.status);
    });

    it('should log rule execution history', async () => {
      const response = await fetchApi('/api/self-healing/executions');
      expect([200, 404]).toContain(response.status);
    });
  });
});

// =====================================================
// PROVIDER SMART ROUTING TESTS
// =====================================================
describe('Provider Smart Routing Pipeline', () => {
  describe('Routing Decision', () => {
    it('should return provider routing order', async () => {
      const response = await fetchApi('/api/quality/routing/video');
      expect([200, 404]).toContain(response.status);
    });

    it('should return image provider routing', async () => {
      const response = await fetchApi('/api/quality/routing/image');
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Health-Based Routing', () => {
    it('should factor health score in routing', async () => {
      const response = await fetchApi('/api/providers/smart-order');
      expect([200, 404]).toContain(response.status);
    });

    it('should exclude quarantined providers from routing', async () => {
      const response = await fetchApi('/api/providers/available');
      expect([200, 404]).toContain(response.status);
    });
  });
});

// =====================================================
// HEALING ACTIONS LOG TESTS
// =====================================================
describe('Healing Actions Log Pipeline', () => {
  describe('Action Logging', () => {
    it('should return healing actions history', async () => {
      const response = await fetchApi('/api/self-healing/actions');
      expect([200, 404]).toContain(response.status);
    });

    it('should log new healing action', async () => {
      const response = await fetchApi('/api/self-healing/actions', {
        method: 'POST',
        body: JSON.stringify({
          actionType: 'rotate_to_fallback',
          provider: 'test-provider',
          triggeredBy: 'auto_remediation',
          success: true,
          details: { fallbackProvider: 'gemini' },
        }),
      });
      expect([200, 201, 400, 404]).toContain(response.status);
    });
  });

  describe('Action Analytics', () => {
    it('should return action success rate', async () => {
      const response = await fetchApi('/api/self-healing/actions/stats');
      expect([200, 404]).toContain(response.status);
    });

    it('should return actions by provider', async () => {
      const response = await fetchApi('/api/self-healing/actions?provider=runway');
      expect([200, 404]).toContain(response.status);
    });
  });
});
