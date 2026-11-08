import { expect, test, type Page } from '@playwright/test';

async function openSecurity(page: Page): Promise<void> {
  await page.goto('/');
  await page.locator('#jarvis-module-select').selectOption('security');
  await expect(page.locator('.security-card').first()).toBeVisible();
}

test('shows that the public Spring Boot health endpoint responds', async ({ page }) => {
  await page.route('**/api/security/health', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'UP' }),
    });
  });

  await openSecurity(page);
  await expect(
    page.locator('.security-card').first().locator('.security-card__status--reachable'),
  ).toBeVisible();
});

test('shows unavailable status when the backend is down', async ({ page }) => {
  await page.route('**/api/security/health', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'DOWN' }),
    });
  });

  await openSecurity(page);
  const status = page.locator('.security-card').first().locator('.security-card__status');
  await expect(status).toHaveText(
    /Brak odpowiedzi API|No valid API response|security\.unavailable/,
  );
});

test('shows authenticated status from a simulated Electron bridge', async ({ page }) => {
  // This is a renderer UI test; real IPC authorization is tested separately.
  await page.addInitScript(() => {
    Object.defineProperty(window, 'jarvisDesktop', {
      configurable: true,
      value: {
        checkPrivateHealth: async () => ({ status: 'authenticated' }),
      },
    });
  });

  await openSecurity(page);
  await expect(
    page.locator('.security-card').first().locator('.security-card__status--authenticated'),
  ).toBeVisible();
});
