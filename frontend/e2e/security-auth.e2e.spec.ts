import { test, expect } from '@playwright/test';

// Browser E2E: simulates Electron's narrow preload API.
// It does NOT prove that Electron IPC is isolated; Node and Java tests cover
// the corresponding helper and Spring Security separately.
test('displays authenticated API status from desktop bridge', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'jarvisDesktop', {
      configurable: true,
      value: {
        checkPrivateHealth: async () => ({ status: 'authenticated' }),
      },
    });
  });

  await page.goto('/');
  await page.locator('#jarvis-module-select').selectOption('security');

  await expect(
    page.locator('.security-card').first().locator('.security-card__status')
  ).toContainText('Połączenie uwierzytelnione');
});
