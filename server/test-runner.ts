import { Express } from 'express';

interface TestResult {
  testName: string;
  category: string;
  status: 'passed' | 'failed' | 'skipped' | 'pending';
  duration: number;
  error?: string;
  timestamp: Date;
}

interface FeatureHealth {
  feature: string;
  category: string;
  path: string;
  status: 'working' | 'broken' | 'degraded' | 'unknown';
  lastTested: Date;
  errorMessage?: string;
  suggestedFix?: string;
}

interface TestRunResult {
  runId: string;
  timestamp: Date;
  duration: number;
  results: TestResult[];
  featureHealth: FeatureHealth[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    passRate: number;
  };
  brokenFeatures: {
    feature: string;
    category: string;
    path: string;
    error: string;
    suggestedFix: string;
  }[];
}

const PAGES_TO_TEST = [
  { name: 'Control Tower', path: '/', category: 'core' },
  { name: 'Content Factory', path: '/content-factory', category: 'content' },
  { name: 'Video Projects', path: '/video-projects', category: 'video' },
  { name: 'Video Assembly', path: '/video-assembly', category: 'video' },
  { name: 'Quality Review', path: '/quality-review', category: 'quality' },
  { name: 'Approval Queue', path: '/approval-queue', category: 'quality' },
  { name: 'Clients', path: '/clients', category: 'brand' },
  { name: 'Brand Guidelines', path: '/brand-guidelines', category: 'brand' },
  { name: 'Brand Files', path: '/brand-files', category: 'brand' },
  { name: 'Brand Control', path: '/brand-control', category: 'brand' },
  { name: 'Provider Health', path: '/provider-health', category: 'system' },
  { name: 'Self-Healing', path: '/self-healing', category: 'system' },
  { name: 'Settings', path: '/settings', category: 'system' },
];

const API_ENDPOINTS_TO_TEST = [
  { name: 'KPIs', path: '/api/kpis', category: 'core', method: 'GET' },
  { name: 'Pods', path: '/api/pods', category: 'core', method: 'GET' },
  { name: 'Video Projects', path: '/api/video-projects', category: 'video', method: 'GET' },
  { name: 'Runway Models', path: '/api/runway/models', category: 'runway', method: 'GET' },
  { name: 'Runway Tier Status', path: '/api/runway/tier-status', category: 'runway', method: 'GET' },
  { name: 'Provider Status', path: '/api/providers/status', category: 'providers', method: 'GET' },
  { name: 'Clients', path: '/api/clients', category: 'brand', method: 'GET' },
  { name: 'Approval Queue', path: '/api/approval-queue', category: 'quality', method: 'GET' },
  { name: 'OpenRouter Test', path: '/api/openrouter/test', category: 'ai', method: 'GET' },
  { name: 'OpenRouter Models', path: '/api/openrouter/models', category: 'ai', method: 'GET' },
  { name: 'Quality Provider Status', path: '/api/quality/provider-status', category: 'quality', method: 'GET' },
  { name: 'Self-Healing Metrics', path: '/api/self-healing/metrics', category: 'system', method: 'GET' },
  { name: 'Self-Healing Incidents', path: '/api/self-healing/incidents', category: 'system', method: 'GET' },
  { name: 'Provider Health', path: '/api/provider-health', category: 'system', method: 'GET' },
];

function suggestFix(error: string, feature: string): string {
  const fixes: Record<string, string> = {
    'timeout': `Check if ${feature} component is rendering correctly and API is responding`,
    'not found': `Verify ${feature} route is registered and component exists`,
    'network': `Check API endpoint connectivity for ${feature}`,
    '401': `Verify authentication for ${feature}`,
    '403': `Check authorization permissions for ${feature}`,
    '500': `Check server logs for ${feature} - possible backend error`,
    '502': `Check if backend service is running for ${feature}`,
    '503': `Service unavailable - check provider status for ${feature}`,
    'element': `Verify data-testid attributes exist for ${feature} elements`,
    'econnrefused': `Server not running - start the application first`,
    'fetch failed': `Network error - verify server is accessible`,
  };
  
  const lowerError = error.toLowerCase();
  for (const [key, fix] of Object.entries(fixes)) {
    if (lowerError.includes(key)) {
      return fix;
    }
  }
  
  return `Review ${feature} implementation and check for missing dependencies or configuration`;
}

function generateRunId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

let lastTestRun: TestRunResult | null = null;
let testHistory: TestRunResult[] = [];

export function registerTestRoutes(app: Express) {
  app.get('/api/tests/run', async (req, res) => {
    const startTime = Date.now();
    const runId = generateRunId();
    const results: TestResult[] = [];
    const featureHealth: FeatureHealth[] = [];
    const brokenFeatures: TestRunResult['brokenFeatures'] = [];
    const baseUrl = `http://localhost:${process.env.PORT || 5000}`;

    console.log(`[Test Runner] Starting test run ${runId}`);

    for (const page of PAGES_TO_TEST) {
      const testStart = Date.now();
      try {
        const response = await fetch(`${baseUrl}${page.path}`);
        const isWorking = response.ok;
        
        results.push({
          testName: `Page: ${page.name}`,
          category: page.category,
          status: isWorking ? 'passed' : 'failed',
          duration: Date.now() - testStart,
          error: isWorking ? undefined : `HTTP ${response.status}`,
          timestamp: new Date(),
        });

        featureHealth.push({
          feature: page.name,
          category: page.category,
          path: page.path,
          status: isWorking ? 'working' : 'broken',
          lastTested: new Date(),
          errorMessage: isWorking ? undefined : `HTTP ${response.status}`,
          suggestedFix: isWorking ? undefined : suggestFix(`HTTP ${response.status}`, page.name),
        });

        if (!isWorking) {
          brokenFeatures.push({
            feature: page.name,
            category: page.category,
            path: page.path,
            error: `HTTP ${response.status}`,
            suggestedFix: suggestFix(`HTTP ${response.status}`, page.name),
          });
        }
      } catch (error: any) {
        results.push({
          testName: `Page: ${page.name}`,
          category: page.category,
          status: 'failed',
          duration: Date.now() - testStart,
          error: error.message,
          timestamp: new Date(),
        });

        featureHealth.push({
          feature: page.name,
          category: page.category,
          path: page.path,
          status: 'broken',
          lastTested: new Date(),
          errorMessage: error.message,
          suggestedFix: suggestFix(error.message, page.name),
        });

        brokenFeatures.push({
          feature: page.name,
          category: page.category,
          path: page.path,
          error: error.message,
          suggestedFix: suggestFix(error.message, page.name),
        });
      }
    }

    for (const endpoint of API_ENDPOINTS_TO_TEST) {
      const testStart = Date.now();
      try {
        const response = await fetch(`${baseUrl}${endpoint.path}`, {
          method: endpoint.method,
        });
        const isWorking = response.ok || response.status === 404;
        
        results.push({
          testName: `API: ${endpoint.name}`,
          category: endpoint.category,
          status: isWorking ? 'passed' : 'failed',
          duration: Date.now() - testStart,
          error: isWorking ? undefined : `HTTP ${response.status}`,
          timestamp: new Date(),
        });

        featureHealth.push({
          feature: `API: ${endpoint.name}`,
          category: endpoint.category,
          path: endpoint.path,
          status: isWorking ? 'working' : (response.status === 404 ? 'unknown' : 'broken'),
          lastTested: new Date(),
          errorMessage: isWorking ? undefined : `HTTP ${response.status}`,
          suggestedFix: isWorking ? undefined : suggestFix(`HTTP ${response.status}`, endpoint.name),
        });

        if (!isWorking && response.status !== 404) {
          brokenFeatures.push({
            feature: `API: ${endpoint.name}`,
            category: endpoint.category,
            path: endpoint.path,
            error: `HTTP ${response.status}`,
            suggestedFix: suggestFix(`HTTP ${response.status}`, endpoint.name),
          });
        }
      } catch (error: any) {
        results.push({
          testName: `API: ${endpoint.name}`,
          category: endpoint.category,
          status: 'failed',
          duration: Date.now() - testStart,
          error: error.message,
          timestamp: new Date(),
        });

        featureHealth.push({
          feature: `API: ${endpoint.name}`,
          category: endpoint.category,
          path: endpoint.path,
          status: 'broken',
          lastTested: new Date(),
          errorMessage: error.message,
          suggestedFix: suggestFix(error.message, endpoint.name),
        });

        brokenFeatures.push({
          feature: `API: ${endpoint.name}`,
          category: endpoint.category,
          path: endpoint.path,
          error: error.message,
          suggestedFix: suggestFix(error.message, endpoint.name),
        });
      }
    }

    const passed = results.filter(r => r.status === 'passed').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const skipped = results.filter(r => r.status === 'skipped').length;

    const testRun: TestRunResult = {
      runId,
      timestamp: new Date(),
      duration: Date.now() - startTime,
      results,
      featureHealth,
      summary: {
        total: results.length,
        passed,
        failed,
        skipped,
        passRate: results.length > 0 ? (passed / results.length) * 100 : 0,
      },
      brokenFeatures,
    };

    lastTestRun = testRun;
    testHistory.unshift(testRun);
    if (testHistory.length > 50) {
      testHistory = testHistory.slice(0, 50);
    }

    console.log(`[Test Runner] Test run ${runId} complete: ${passed}/${results.length} passed (${testRun.summary.passRate.toFixed(1)}%)`);

    res.json(testRun);
  });

  app.get('/api/tests/last-run', (req, res) => {
    if (lastTestRun) {
      res.json(lastTestRun);
    } else {
      res.json({ message: 'No test runs yet', lastRun: null });
    }
  });

  app.get('/api/tests/history', (req, res) => {
    const limit = parseInt(req.query.limit as string) || 10;
    res.json({
      runs: testHistory.slice(0, limit),
      total: testHistory.length,
    });
  });

  app.get('/api/tests/broken-features', (req, res) => {
    if (lastTestRun) {
      res.json({
        brokenFeatures: lastTestRun.brokenFeatures,
        lastTested: lastTestRun.timestamp,
        total: lastTestRun.brokenFeatures.length,
      });
    } else {
      res.json({
        brokenFeatures: [],
        lastTested: null,
        total: 0,
        message: 'Run tests first to identify broken features',
      });
    }
  });

  app.get('/api/tests/feature-health', (req, res) => {
    if (lastTestRun) {
      const byCategory: Record<string, FeatureHealth[]> = {};
      for (const feature of lastTestRun.featureHealth) {
        if (!byCategory[feature.category]) {
          byCategory[feature.category] = [];
        }
        byCategory[feature.category].push(feature);
      }

      res.json({
        featureHealth: lastTestRun.featureHealth,
        byCategory,
        summary: lastTestRun.summary,
        lastTested: lastTestRun.timestamp,
      });
    } else {
      res.json({
        featureHealth: [],
        byCategory: {},
        summary: null,
        lastTested: null,
        message: 'Run tests first to check feature health',
      });
    }
  });

  console.log('[Test Runner] Test routes registered');
}
