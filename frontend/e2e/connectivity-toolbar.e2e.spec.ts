import { expect, test } from '@playwright/test';

test('network and action icons render and radio is crossed offline', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.locator('[data-testid="network-state"]')).toBeVisible();
  await expect(page.locator('[data-testid="install-link"]')).toBeVisible();
  await expect(page.locator('[data-testid="browser-link"]')).toBeVisible();

  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await expect(page.locator('[data-testid="install-link"]')).toBeDisabled();
  await expect(page.locator('[data-testid="browser-link"]')).toBeDisabled();
  await expect(page.locator('.radio-control__icon--offline')).toBeVisible();
});
