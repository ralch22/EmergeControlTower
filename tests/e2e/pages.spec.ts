import { test, expect } from '@playwright/test';
import { PAGES, waitForPageLoad } from '../utils/test-helpers';

test.describe('Page Navigation Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForPageLoad(page);
  });

  test('Control Tower page loads correctly', async ({ page }) => {
    await page.goto(PAGES.controlTower);
    await waitForPageLoad(page);
    
    await expect(page).toHaveURL('/');
    await expect(page.locator('body')).toBeVisible();
    
    const hasContent = await page.locator('main, [role="main"], .container, #root').first().isVisible();
    expect(hasContent).toBeTruthy();
  });

  test('Content Factory page loads correctly', async ({ page }) => {
    await page.goto(PAGES.contentFactory);
    await waitForPageLoad(page);
    
    await expect(page).toHaveURL(PAGES.contentFactory);
    const hasContent = await page.locator('main, [role="main"], .container').first().isVisible();
    expect(hasContent).toBeTruthy();
  });

  test('Video Projects page loads correctly', async ({ page }) => {
    await page.goto(PAGES.videoProjects);
    await waitForPageLoad(page);
    
    await expect(page).toHaveURL(PAGES.videoProjects);
    const hasContent = await page.locator('main, [role="main"], .container').first().isVisible();
    expect(hasContent).toBeTruthy();
  });

  test('Video Assembly page loads correctly', async ({ page }) => {
    await page.goto(PAGES.videoAssembly);
    await waitForPageLoad(page);
    
    await expect(page).toHaveURL(PAGES.videoAssembly);
  });

  test('Quality Review page loads correctly', async ({ page }) => {
    await page.goto(PAGES.qualityReview);
    await waitForPageLoad(page);
    
    await expect(page).toHaveURL(PAGES.qualityReview);
  });

  test('Approval Queue page loads correctly', async ({ page }) => {
    await page.goto(PAGES.approvalQueue);
    await waitForPageLoad(page);
    
    await expect(page).toHaveURL(PAGES.approvalQueue);
  });

  test('Clients page loads correctly', async ({ page }) => {
    await page.goto(PAGES.clients);
    await waitForPageLoad(page);
    
    await expect(page).toHaveURL(PAGES.clients);
  });

  test('Brand Guidelines page loads correctly', async ({ page }) => {
    await page.goto(PAGES.brandGuidelines);
    await waitForPageLoad(page);
    
    await expect(page).toHaveURL(PAGES.brandGuidelines);
  });

  test('Brand Files page loads correctly', async ({ page }) => {
    await page.goto(PAGES.brandFiles);
    await waitForPageLoad(page);
    
    await expect(page).toHaveURL(PAGES.brandFiles);
  });

  test('Brand Control page loads correctly', async ({ page }) => {
    await page.goto(PAGES.brandControl);
    await waitForPageLoad(page);
    
    await expect(page).toHaveURL(PAGES.brandControl);
  });

  test('Provider Health page loads correctly', async ({ page }) => {
    await page.goto(PAGES.providerHealth);
    await waitForPageLoad(page);
    
    await expect(page).toHaveURL(PAGES.providerHealth);
  });

  test('Settings page loads correctly', async ({ page }) => {
    await page.goto(PAGES.settings);
    await waitForPageLoad(page);
    
    await expect(page).toHaveURL(PAGES.settings);
  });

  test('Self-Healing page loads correctly', async ({ page }) => {
    await page.goto(PAGES.selfHealing);
    await waitForPageLoad(page);
    
    await expect(page).toHaveURL(PAGES.selfHealing);
  });
});

test.describe('Sidebar Navigation Tests', () => {
  test('Sidebar is visible and contains navigation links', async ({ page }) => {
    await page.goto('/');
    await waitForPageLoad(page);
    
    const sidebar = page.locator('aside, [data-testid*="sidebar"], nav').first();
    await expect(sidebar).toBeVisible();
  });

  test('Can navigate between pages using sidebar', async ({ page }) => {
    await page.goto('/');
    await waitForPageLoad(page);
    
    const videoProjectsLink = page.locator('a[href="/video-projects"], [data-testid*="video-projects"]').first();
    if (await videoProjectsLink.isVisible()) {
      await videoProjectsLink.click();
      await waitForPageLoad(page);
      await expect(page).toHaveURL('/video-projects');
    }
  });
});
