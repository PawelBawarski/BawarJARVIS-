import { test, expect } from '@playwright/test';

test('sidebar shows only a non-clickable network indicator', async ({ page }) => {
  await page.goto('/');
  const indicator = page.getByTestId('network-state');
  await expect(indicator).toBeVisible();
  await expect(indicator).toHaveAttribute('role', 'status');
  await expect(page.getByTestId('install-link')).toHaveCount(0);
  await expect(page.getByTestId('browser-link')).toHaveCount(0);
  await expect(page.locator('app-connectivity-toolbar button')).toHaveCount(0);
});
