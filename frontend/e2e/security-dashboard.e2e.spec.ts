import { expect, test } from '@playwright/test';

test.describe('JARVIS — diagnostyka backendu', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('jarvis.language', 'pl');
    });
  });

  test('pokazuje API odpowiada przy poprawnej odpowiedzi backendu', async ({ page }) => {
    await page.route('**/api/security/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'UP' }),
      });
    });

    await page.goto('/');
    await page.locator('#jarvis-module-select').selectOption('security');

    const backendCard = page.locator('.security-card').filter({
      hasText: 'Spring Boot API',
    });

    await expect(backendCard).toBeVisible();
    await expect(backendCard).toContainText('API odpowiada');
  });

  test('nie oznacza backendu jako dostępnego przy błędzie serwera', async ({ page }) => {
    await page.route('**/api/security/health', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'DOWN' }),
      });
    });

    await page.goto('/');
    await page.locator('#jarvis-module-select').selectOption('security');

    const backendCard = page.locator('.security-card').filter({
      hasText: 'Spring Boot API',
    });

    await expect(backendCard).toContainText('Brak odpowiedzi API');
    await expect(backendCard).not.toContainText('API odpowiada');
  });
});
