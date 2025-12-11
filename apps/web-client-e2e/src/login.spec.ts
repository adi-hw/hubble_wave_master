import { test, expect } from '@playwright/test';

const baseURL = process.env.WEB_BASE_URL;
const username = process.env.WEB_USERNAME;
const password = process.env.WEB_PASSWORD;

test.describe('web-client smoke', () => {
  test.skip(!baseURL, 'WEB_BASE_URL not set; skipping web-client e2e smoke tests');

  test('login page is reachable', async ({ page }) => {
    await page.goto(`${baseURL}/login`);
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('home shell loads', async ({ page }) => {
    await page.goto(`${baseURL}/ui/home`);
    await expect(page.locator('body')).toBeVisible();
  });

  test('login flow succeeds with provided credentials', async ({ page }) => {
    test.skip(!username || !password, 'WEB_USERNAME/WEB_PASSWORD not set');
    await page.goto(`${baseURL}/login`);
    await page.fill('input[type="email"], input[name="email"], input[name="username"]', username!);
    await page.fill('input[type="password"], input[name="password"]', password!);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/ui\/home/i, { timeout: 10000 });
  });
});
