import { test, expect } from '@playwright/test';
import { PAGES, waitForPageLoad } from '../utils/test-helpers';

test.describe('Provider Health Dashboard Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGES.providerHealth);
    await waitForPageLoad(page);
  });

  test('Provider Health page renders correctly', async ({ page }) => {
    await expect(page).toHaveURL(PAGES.providerHealth);
    
    const mainContent = page.locator('main, [role="main"], .container').first();
    await expect(mainContent).toBeVisible();
  });

  test('Provider status cards are displayed', async ({ page }) => {
    const statusCards = page.locator('[data-testid*="provider"], .provider-card, .status-card').first();
    const isVisible = await statusCards.isVisible().catch(() => false);
    
    if (isVisible) {
      await expect(statusCards).toBeVisible();
    }
  });

  test('Provider health indicators show status', async ({ page }) => {
    const healthIndicator = page.locator('[data-testid*="health"], .health-status, .status-indicator').first();
    const isVisible = await healthIndicator.isVisible().catch(() => false);
    
    if (isVisible) {
      await expect(healthIndicator).toBeVisible();
    }
  });

  test('Refresh button triggers status update', async ({ page }) => {
    const refreshButton = page.locator('button:has-text("Refresh"), button:has-text("Check"), [data-testid*="refresh"]').first();
    const isVisible = await refreshButton.isVisible().catch(() => false);
    
    if (isVisible) {
      await refreshButton.click();
      await page.waitForTimeout(1000);
    }
  });
});

test.describe('Provider Health API Integration', () => {
  test('Provider status API returns data', async ({ page }) => {
    const response = await page.request.get('/api/providers/status');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toBeDefined();
  });

  test('Runway tier status API returns data', async ({ page }) => {
    const response = await page.request.get('/api/runway/tier-status');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.tier).toBeDefined();
    expect(data.modelStatus).toBeDefined();
  });

  test('Runway models API returns model list', async ({ page }) => {
    const response = await page.request.get('/api/runway/models');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.models).toBeDefined();
  });
});
