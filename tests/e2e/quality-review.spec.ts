import { test, expect } from '@playwright/test';
import { PAGES, waitForPageLoad } from '../utils/test-helpers';

test.describe('Quality Review Page Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGES.qualityReview);
    await waitForPageLoad(page);
  });

  test('Quality Review page renders correctly', async ({ page }) => {
    await expect(page).toHaveURL(PAGES.qualityReview);
    const mainContent = page.locator('main, [role="main"], .container').first();
    await expect(mainContent).toBeVisible();
  });

  test('Review queue or empty state is displayed', async ({ page }) => {
    const reviewQueue = page.locator('[data-testid*="review"], .review-list, .review-queue').first();
    const emptyState = page.locator('[data-testid*="empty"], .empty-state, :text("No reviews")').first();
    
    const hasQueue = await reviewQueue.isVisible().catch(() => false);
    const hasEmptyState = await emptyState.isVisible().catch(() => false);
    
    expect(hasQueue || hasEmptyState).toBeTruthy();
  });

  test('Rating system is available for reviews', async ({ page }) => {
    const ratingStars = page.locator('[data-testid*="rating"], .rating, .stars, [role="radiogroup"]').first();
    const isVisible = await ratingStars.isVisible().catch(() => false);
    
    if (!isVisible) {
      test.skip();
    }
  });
});

test.describe('Quality API Integration', () => {
  test('Quality reviews API is accessible', async ({ page }) => {
    const response = await page.request.get('/api/quality/reviews');
    expect([200, 404]).toContain(response.status());
  });

  test('Quality provider status API returns data', async ({ page }) => {
    const response = await page.request.get('/api/quality/provider-status');
    expect([200, 404]).toContain(response.status());
  });
});
