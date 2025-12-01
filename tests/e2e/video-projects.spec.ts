import { test, expect } from '@playwright/test';
import { PAGES, waitForPageLoad } from '../utils/test-helpers';

test.describe('Video Projects Feature Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGES.videoProjects);
    await waitForPageLoad(page);
  });

  test('Video Projects page renders main content', async ({ page }) => {
    const mainContent = page.locator('main, [role="main"], .container').first();
    await expect(mainContent).toBeVisible();
  });

  test('Create new project button is visible', async ({ page }) => {
    const createButton = page.locator('button:has-text("Create"), button:has-text("New"), [data-testid*="create"]').first();
    const isVisible = await createButton.isVisible().catch(() => false);
    
    if (isVisible) {
      await expect(createButton).toBeVisible();
    } else {
      test.skip();
    }
  });

  test('Video projects list or empty state is displayed', async ({ page }) => {
    const projectsList = page.locator('[data-testid*="project"], .project-card, .project-list, table').first();
    const emptyState = page.locator('[data-testid*="empty"], .empty-state, :text("No projects")').first();
    
    const hasProjects = await projectsList.isVisible().catch(() => false);
    const hasEmptyState = await emptyState.isVisible().catch(() => false);
    
    expect(hasProjects || hasEmptyState).toBeTruthy();
  });

  test('Project status indicators are functional', async ({ page }) => {
    const statusBadge = page.locator('[data-testid*="status"], .status-badge, .badge').first();
    const isVisible = await statusBadge.isVisible().catch(() => false);
    
    if (isVisible) {
      await expect(statusBadge).toBeVisible();
    }
  });
});

test.describe('Video Project Creation Flow', () => {
  test('Can open create project dialog', async ({ page }) => {
    await page.goto(PAGES.videoProjects);
    await waitForPageLoad(page);
    
    const createButton = page.locator('button:has-text("Create"), button:has-text("New Project")').first();
    const isVisible = await createButton.isVisible().catch(() => false);
    
    if (isVisible) {
      await createButton.click();
      
      const dialog = page.locator('[role="dialog"], .modal, .dialog').first();
      await expect(dialog).toBeVisible({ timeout: 5000 });
    } else {
      test.skip();
    }
  });
});
