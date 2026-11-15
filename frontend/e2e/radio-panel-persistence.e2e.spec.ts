import { expect, test } from '@playwright/test';

test('Radio continues playing after panel close/reopen and module change', async ({ page }) => {
  let catalogRequests = 0;
  await page.addInitScript(() => {
    // Only browser media playback is simulated; all UI actions stay real.
    HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
    HTMLMediaElement.prototype.pause = function () { /* no actual audio in the test */ };
  });
  await page.route('**/api/radio/stations?**', route => {
    catalogRequests++;
    return route.fulfill({ json: [{
      id: 'pl-demo', name: 'Test Radio', countryCode: 'PL',
      streamUrl: 'https://example.org/test.mp3',
    }] });
  });
  await page.goto('/chat');
  const toggle = page.getByTestId('radio-trigger');
  await toggle.click();
  await expect(page.getByTestId('radio-play')).toBeEnabled();
  await page.getByTestId('radio-play').click();
  await expect(page.getByTestId('radio-status')).toContainText(/odtwarz|playing/i);
  await page.getByTestId('radio-panel').locator('.radio-panel__close').click();
  await expect(page.getByTestId('radio-panel')).toBeHidden();
  await toggle.click();
  await expect(page.getByTestId('radio-stop')).toBeEnabled();
  await expect(page.getByTestId('radio-status')).toContainText(/odtwarz|playing/i);
  expect(catalogRequests).toBe(1);
  // Change module through Angular router: a full browser reload would also reset audio.
  await page.locator('#jarvis-module-select').selectOption('lab');
  await expect(page).toHaveURL(/lab/);
  await toggle.click();
  await expect(page.getByTestId('radio-stop')).toBeEnabled();
  await expect(page.getByTestId('radio-status')).toContainText(/odtwarz|playing/i);
  await page.getByTestId('radio-stop').click();
  await expect(page.getByTestId('radio-play')).toBeEnabled();
});
