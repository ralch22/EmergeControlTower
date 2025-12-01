import { test, expect } from '@playwright/test';
import { PAGES, waitForPageLoad } from '../utils/test-helpers';

test.describe('Content Factory Page Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGES.contentFactory);
    await waitForPageLoad(page);
  });

  test('Content Factory page renders correctly', async ({ page }) => {
    await expect(page).toHaveURL(PAGES.contentFactory);
    const mainContent = page.locator('main, [role="main"], .container').first();
    await expect(mainContent).toBeVisible();
  });

  test('Content generation controls are available', async ({ page }) => {
    const controls = page.locator('button, input, select, [role="button"]').first();
    await expect(controls).toBeVisible();
  });
});
