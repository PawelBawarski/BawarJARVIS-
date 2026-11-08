import { test, expect } from '@playwright/test';

test('network indicator is not clickable', async ({ page }) => {
  await page.goto('/');

  const indicator = page.getByTestId('network-state');

  await expect(indicator).toBeVisible();
  await expect(indicator).toHaveAttribute('role', 'status');

  await expect(page.locator('button[data-testid="network-state"]')).toHaveCount(0);

  await expect(page.getByTestId('install-link')).toBeVisible();
  await expect(page.getByTestId('browser-link')).toBeVisible();
});
