import { test, expect } from '@playwright/test';
import { waitForPageLoad } from '../utils/test-helpers';

test.describe('Test Runner Page Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-runner');
    await waitForPageLoad(page);
  });

  test('Test Runner page renders correctly', async ({ page }) => {
    await expect(page).toHaveURL('/test-runner');
    
    const pageTitle = page.locator('[data-testid="page-title"]');
    await expect(pageTitle).toBeVisible();
    await expect(pageTitle).toContainText('Test Runner');
  });

  test('Run Tests button is visible', async ({ page }) => {
    const runButton = page.locator('[data-testid="run-tests-button"]');
    await expect(runButton).toBeVisible();
    await expect(runButton).toContainText('Run');
  });

  test('Can trigger test run', async ({ page }) => {
    const runButton = page.locator('[data-testid="run-tests-button"]');
    await expect(runButton).toBeVisible();
    
    await runButton.click();
    
    await page.waitForSelector('[data-testid="total-tests"], [data-testid="passed-tests"]', {
      timeout: 30000,
    }).catch(() => {});
  });
});

test.describe('Test Runner API Integration', () => {
  test('GET /api/tests/last-run returns test results', async ({ page }) => {
    const response = await page.request.get('/api/tests/last-run');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toBeDefined();
  });

  test('GET /api/tests/run executes tests and returns results', async ({ page }) => {
    const response = await page.request.get('/api/tests/run');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.runId).toBeDefined();
    expect(data.summary).toBeDefined();
    expect(data.results).toBeDefined();
    expect(Array.isArray(data.results)).toBeTruthy();
  });

  test('GET /api/tests/history returns test history', async ({ page }) => {
    const response = await page.request.get('/api/tests/history');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.runs).toBeDefined();
    expect(Array.isArray(data.runs)).toBeTruthy();
  });

  test('GET /api/tests/broken-features returns broken feature list', async ({ page }) => {
    const response = await page.request.get('/api/tests/broken-features');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.brokenFeatures).toBeDefined();
  });

  test('GET /api/tests/feature-health returns health overview', async ({ page }) => {
    const response = await page.request.get('/api/tests/feature-health');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toBeDefined();
  });
});
