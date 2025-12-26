import { test, expect } from '@playwright/test';

test.describe('App Shell smoke', () => {
  test('has core landmarks and mobile bottom nav height token', async ({ page }) => {
    await page.goto('/');

    // Landmarks
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('nav')).toBeVisible();

    // Command palette shortcut should open overlay
    await page.keyboard.press('Control+K');
    await expect(page.getByRole('dialog', { name: /Command palette/i })).toBeVisible();
    await page.keyboard.press('Escape');

    // Mobile bottom nav height matches token when resized
    await page.setViewportSize({ width: 375, height: 700 });
    const height = await page.locator('nav').first().evaluate((el) =>
      getComputedStyle(el).getPropertyValue('--bottom-nav-height')
    );
    expect(height.trim()).toBe('56px');
  });
});

