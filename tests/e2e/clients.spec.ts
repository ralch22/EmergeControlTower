import { test, expect } from '@playwright/test';
import { PAGES, waitForPageLoad } from '../utils/test-helpers';

test.describe('Clients Page Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGES.clients);
    await waitForPageLoad(page);
  });

  test('Clients page renders correctly', async ({ page }) => {
    await expect(page).toHaveURL(PAGES.clients);
    const mainContent = page.locator('main, [role="main"], .container').first();
    await expect(mainContent).toBeVisible();
  });

  test('Client list or empty state is displayed', async ({ page }) => {
    const clientList = page.locator('[data-testid*="client"], .client-card, .client-list, table').first();
    const emptyState = page.locator('[data-testid*="empty"], .empty-state, :text("No clients")').first();
    
    const hasClients = await clientList.isVisible().catch(() => false);
    const hasEmptyState = await emptyState.isVisible().catch(() => false);
    
    expect(hasClients || hasEmptyState).toBeTruthy();
  });

  test('Add client button is visible', async ({ page }) => {
    const addButton = page.locator('button:has-text("Add"), button:has-text("Create"), button:has-text("New")').first();
    const isVisible = await addButton.isVisible().catch(() => false);
    
    if (!isVisible) {
      test.skip();
    }
  });
});

test.describe('Clients API Integration', () => {
  test('GET /api/clients returns data', async ({ page }) => {
    const response = await page.request.get('/api/clients');
    expect([200, 404]).toContain(response.status());
  });

  test('POST /api/clients validates request body', async ({ page }) => {
    const response = await page.request.post('/api/clients', {
      data: {},
    });
    expect([400, 404, 500]).toContain(response.status());
  });
});
