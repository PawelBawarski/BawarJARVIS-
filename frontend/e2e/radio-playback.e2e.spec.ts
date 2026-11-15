import { test, expect } from '@playwright/test';

test('Radio loads catalog, switches country and exposes playback controls', async ({ page }) => {
  await page.route('**/api/radio/stations?**', async route => {
    const country = new URL(route.request().url()).searchParams.get('country') || 'PL';
    await route.fulfill({ json: [{
      id: country + '-demo', name: country + ' Demo Radio', countryCode: country,
      streamUrl: 'https://radio.example.org/live.mp3',
    }] });
  });
  await page.goto('/chat');
  await page.getByTestId('radio-trigger').click();
  const panel = page.getByTestId('radio-panel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('#radio-station')).toContainText('PL Demo Radio');
  await expect(page.getByTestId('radio-play')).toBeEnabled();
  await panel.locator('#radio-country').selectOption('GB');
  await expect(panel.locator('#radio-station')).toContainText('GB Demo Radio');
  await expect(page.getByTestId('radio-stop')).toBeDisabled();
  await expect(panel.locator('#radio-volume')).toHaveValue('60');
  await panel.locator('#radio-volume').fill('35');
  await expect(panel.locator('#radio-volume')).toHaveValue('35');
});
