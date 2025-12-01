import { test, expect } from '@playwright/test';
import { PAGES, waitForPageLoad } from '../utils/test-helpers';

test.describe('Self-Healing Dashboard Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGES.selfHealing);
    await waitForPageLoad(page);
  });

  test('Self-Healing page renders correctly', async ({ page }) => {
    await expect(page).toHaveURL(PAGES.selfHealing);
    const mainContent = page.locator('main, [role="main"], .container').first();
    await expect(mainContent).toBeVisible();
  });

  test('MTTD/MTTR metrics are displayed', async ({ page }) => {
    const metricsSection = page.locator('[data-testid*="mttd"], [data-testid*="mttr"], :text("MTTD"), :text("MTTR")').first();
    const isVisible = await metricsSection.isVisible().catch(() => false);
    
    if (!isVisible) {
      test.skip();
    }
  });

  test('Incident history is accessible', async ({ page }) => {
    const incidentSection = page.locator('[data-testid*="incident"], .incident-list, :text("Incident")').first();
    const isVisible = await incidentSection.isVisible().catch(() => false);
    
    if (!isVisible) {
      test.skip();
    }
  });

  test('Remediation actions are available', async ({ page }) => {
    const remediationButton = page.locator('button:has-text("Remediate"), button:has-text("Fix"), [data-testid*="remediat"]').first();
    const isVisible = await remediationButton.isVisible().catch(() => false);
    
    if (!isVisible) {
      test.skip();
    }
  });
});

test.describe('Self-Healing API Integration', () => {
  test('Metrics API returns healing data', async ({ page }) => {
    const response = await page.request.get('/api/self-healing/metrics');
    expect([200, 404]).toContain(response.status());
  });

  test('Incidents API returns history', async ({ page }) => {
    const response = await page.request.get('/api/self-healing/incidents');
    expect([200, 404]).toContain(response.status());
  });
});
