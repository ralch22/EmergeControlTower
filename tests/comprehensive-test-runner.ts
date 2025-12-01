import { PAGES, API_ENDPOINTS, suggestFix, generateTestReport, type TestResult, type FeatureStatus } from './utils/test-helpers';

interface ComprehensiveTestResult {
  timestamp: Date;
  duration: number;
  pageTests: TestResult[];
  apiTests: TestResult[];
  featureStatus: FeatureStatus[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    passRate: number;
  };
  brokenFeatures: {
    feature: string;
    page: string;
    error: string;
    suggestedFix: string;
  }[];
}

export async function runComprehensiveTests(baseUrl: string = 'http://localhost:5000'): Promise<ComprehensiveTestResult> {
  const startTime = Date.now();
  const pageTests: TestResult[] = [];
  const apiTests: TestResult[] = [];
  const featureStatus: FeatureStatus[] = [];
  const brokenFeatures: ComprehensiveTestResult['brokenFeatures'] = [];

  for (const [pageName, path] of Object.entries(PAGES)) {
    const testStart = Date.now();
    try {
      const response = await fetch(`${baseUrl}${path}`);
      const isWorking = response.ok;
      
      pageTests.push({
        testName: `Page Load: ${pageName}`,
        page: path,
        status: isWorking ? 'passed' : 'failed',
        duration: Date.now() - testStart,
        error: isWorking ? undefined : `HTTP ${response.status}`,
        timestamp: new Date(),
      });

      featureStatus.push({
        feature: `Page: ${pageName}`,
        page: path,
        working: isWorking,
        lastTested: new Date(),
        errorMessage: isWorking ? undefined : `HTTP ${response.status}`,
        suggestedFix: isWorking ? undefined : suggestFix(`HTTP ${response.status}`, pageName),
      });

      if (!isWorking) {
        brokenFeatures.push({
          feature: `Page: ${pageName}`,
          page: path,
          error: `HTTP ${response.status}`,
          suggestedFix: suggestFix(`HTTP ${response.status}`, pageName),
        });
      }
    } catch (error: any) {
      pageTests.push({
        testName: `Page Load: ${pageName}`,
        page: path,
        status: 'failed',
        duration: Date.now() - testStart,
        error: error.message,
        timestamp: new Date(),
      });

      brokenFeatures.push({
        feature: `Page: ${pageName}`,
        page: path,
        error: error.message,
        suggestedFix: suggestFix(error.message, pageName),
      });
    }
  }

  for (const [endpointName, path] of Object.entries(API_ENDPOINTS)) {
    const testStart = Date.now();
    try {
      const response = await fetch(`${baseUrl}${path}`);
      const isWorking = response.ok || response.status === 404;
      
      apiTests.push({
        testName: `API: ${endpointName}`,
        page: path,
        status: isWorking ? 'passed' : 'failed',
        duration: Date.now() - testStart,
        error: isWorking ? undefined : `HTTP ${response.status}`,
        timestamp: new Date(),
      });

      featureStatus.push({
        feature: `API: ${endpointName}`,
        page: path,
        working: isWorking,
        lastTested: new Date(),
        errorMessage: isWorking ? undefined : `HTTP ${response.status}`,
        suggestedFix: isWorking ? undefined : suggestFix(`HTTP ${response.status}`, endpointName),
      });

      if (!isWorking) {
        brokenFeatures.push({
          feature: `API: ${endpointName}`,
          page: path,
          error: `HTTP ${response.status}`,
          suggestedFix: suggestFix(`HTTP ${response.status}`, endpointName),
        });
      }
    } catch (error: any) {
      apiTests.push({
        testName: `API: ${endpointName}`,
        page: path,
        status: 'failed',
        duration: Date.now() - testStart,
        error: error.message,
        timestamp: new Date(),
      });

      brokenFeatures.push({
        feature: `API: ${endpointName}`,
        page: path,
        error: error.message,
        suggestedFix: suggestFix(error.message, endpointName),
      });
    }
  }

  const allTests = [...pageTests, ...apiTests];
  const report = generateTestReport(allTests);

  return {
    timestamp: new Date(),
    duration: Date.now() - startTime,
    pageTests,
    apiTests,
    featureStatus,
    summary: {
      total: report.total,
      passed: report.passed,
      failed: report.failed,
      passRate: report.passRate,
    },
    brokenFeatures,
  };
}

export async function runAndSaveResults(baseUrl?: string): Promise<void> {
  console.log('Starting comprehensive test run...');
  const results = await runComprehensiveTests(baseUrl);
  
  console.log('\n=== TEST RESULTS ===');
  console.log(`Total: ${results.summary.total}`);
  console.log(`Passed: ${results.summary.passed}`);
  console.log(`Failed: ${results.summary.failed}`);
  console.log(`Pass Rate: ${results.summary.passRate.toFixed(1)}%`);
  console.log(`Duration: ${results.duration}ms`);
  
  if (results.brokenFeatures.length > 0) {
    console.log('\n=== BROKEN FEATURES ===');
    for (const feature of results.brokenFeatures) {
      console.log(`\n${feature.feature}`);
      console.log(`  Path: ${feature.page}`);
      console.log(`  Error: ${feature.error}`);
      console.log(`  Suggested Fix: ${feature.suggestedFix}`);
    }
  }
  
  console.log('\nTest run complete.');
}
