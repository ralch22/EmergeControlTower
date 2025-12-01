import { Page } from '@playwright/test';

export interface TestResult {
  testName: string;
  page: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  timestamp: Date;
}

export interface FeatureStatus {
  feature: string;
  page: string;
  working: boolean;
  lastTested: Date;
  errorMessage?: string;
  suggestedFix?: string;
}

export const PAGES = {
  controlTower: '/',
  contentFactory: '/content-factory',
  videoProjects: '/video-projects',
  videoAssembly: '/video-assembly',
  qualityReview: '/quality-review',
  approvalQueue: '/approval-queue',
  clients: '/clients',
  brandGuidelines: '/brand-guidelines',
  brandFiles: '/brand-files',
  brandControl: '/brand-control',
  providerHealth: '/provider-health',
  settings: '/settings',
  selfHealing: '/self-healing',
} as const;

export const API_ENDPOINTS = {
  // KPIs
  kpis: '/api/kpis',
  
  // Pods
  pods: '/api/pods',
  
  // Video
  videoProjects: '/api/video-projects',
  videoProjectsFullGenerate: '/api/video/generate-full',
  
  // Runway
  runwayModels: '/api/runway/models',
  runwayTierStatus: '/api/runway/tier-status',
  runwayVideoGenerate: '/api/runway/video/generate',
  
  // OpenRouter
  openrouterTest: '/api/openrouter/test',
  openrouterModels: '/api/openrouter/models',
  
  // Providers
  providerStatus: '/api/providers/status',
  providerHealth: '/api/provider-health',
  
  // Quality
  qualityReviews: '/api/quality/reviews',
  qualityProviderStatus: '/api/quality/provider-status',
  
  // Self-healing
  selfHealingMetrics: '/api/self-healing/metrics',
  selfHealingIncidents: '/api/self-healing/incidents',
  
  // Clients
  clients: '/api/clients',
  
  // Approvals
  approvalQueue: '/api/approval-queue',
} as const;

export async function waitForPageLoad(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
}

export async function checkElementExists(page: Page, selector: string): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

export async function capturePageState(page: Page): Promise<{
  url: string;
  title: string;
  hasErrors: boolean;
  consoleErrors: string[];
}> {
  const consoleErrors: string[] = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  
  return {
    url: page.url(),
    title: await page.title(),
    hasErrors: consoleErrors.length > 0,
    consoleErrors,
  };
}

export function generateTestReport(results: TestResult[]): {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  passRate: number;
  failedTests: TestResult[];
} {
  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status === 'failed').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  
  return {
    total: results.length,
    passed,
    failed,
    skipped,
    passRate: results.length > 0 ? (passed / results.length) * 100 : 0,
    failedTests: results.filter(r => r.status === 'failed'),
  };
}

export function suggestFix(error: string, feature: string): string {
  const fixes: Record<string, string> = {
    'timeout': `Check if ${feature} component is rendering correctly and API is responding`,
    'not found': `Verify ${feature} route is registered in App.tsx`,
    'network': `Check API endpoint connectivity for ${feature}`,
    '401': `Verify authentication for ${feature}`,
    '500': `Check server logs for ${feature} - possible backend error`,
    'element': `Verify data-testid attributes exist for ${feature} elements`,
  };
  
  for (const [key, fix] of Object.entries(fixes)) {
    if (error.toLowerCase().includes(key)) {
      return fix;
    }
  }
  
  return `Review ${feature} implementation and check for missing dependencies`;
}
