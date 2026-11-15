import { test, expect } from '@playwright/test';

test('Radio transport has three icon-only controls aligned left', async ({ page }) => {
  await page.route('**/api/radio/stations?**', route => route.fulfill({ json: [{
    id: 'pl-one', name: 'Radio Test', countryCode: 'PL',
    streamUrl: 'https://radio.example.org/live.mp3',
  }] }));
  await page.goto('/chat');
  await page.getByTestId('radio-trigger').click();
  const panel = page.getByTestId('radio-panel');
  const play = page.getByTestId('radio-play');
  const pause = page.getByTestId('radio-pause');
  const stop = page.getByTestId('radio-stop');
  await expect(play).toHaveAttribute('aria-label', /.+/);
  await expect(pause).toHaveAttribute('aria-label', /.+/);
  await expect(stop).toHaveAttribute('aria-label', /.+/);
  await expect(play).toHaveText(/^[▶]$/);
  await expect(pause).toHaveText(/^[Ⅱ]$/);
  await expect(stop).toHaveText(/^[■]$/);
  const positions = await Promise.all([play, pause, stop].map(button => button.boundingBox()));
  expect(positions.every(Boolean)).toBeTruthy();
  expect(positions[0]!.y).toBeCloseTo(positions[1]!.y, 0);
  expect(positions[1]!.y).toBeCloseTo(positions[2]!.y, 0);
  expect(positions[0]!.x).toBeLessThan(positions[1]!.x);
  expect(positions[1]!.x).toBeLessThan(positions[2]!.x);
  await expect(panel.locator('.radio-panel__controls')).toHaveCSS('justify-content', 'flex-start');
  const network = page.getByTestId('network-state');
  await expect(network).toHaveJSProperty('tagName', 'BUTTON');
  await network.click();
});
