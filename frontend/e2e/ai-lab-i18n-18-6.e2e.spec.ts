import { expect, test } from '@playwright/test';

test('18.6: Research and Offline Lab update PL/EN without losing input or contacting AI', async ({ page }) => {
  const aiWriteRequests: string[] = [];
  page.on('request', request => {
    if (new URL(request.url()).pathname.startsWith('/api/ai') && request.method() !== 'GET') {
      aiWriteRequests.push(`${request.method()} ${new URL(request.url()).pathname}`);
    }
  });

  await page.goto('/lab');
  const research = page.getByTestId('research-memory');
  await expect(research.getByRole('heading', { name: 'Internet i pamięć wiedzy' })).toBeVisible();
  await research.getByTestId('research-input').fill('Angular Signals');

  const offlineSection = page.getByTestId('jarvis-lab-offline');
  await offlineSection.locator('summary').click();
  await expect(offlineSection).toHaveJSProperty('open', true);
  const offline = page.getByTestId('learning-lab');
  await expect(offline).toBeVisible();
  await expect(offline.locator('.status')).toBeVisible();
  const statusInPolish = (await offline.locator('.status').innerText()).trim();

  await page.getByRole('button', { name: 'Otwórz ustawienia' }).click();
  await page.getByRole('button', { name: 'EN', exact: true }).click();

  await expect(research.getByRole('heading', { name: 'Web research and knowledge memory' })).toBeVisible();
  await expect(research.getByTestId('research-input')).toHaveValue('Angular Signals');
  await expect(offline).toBeVisible();
  await expect(offline.locator('.status')).toBeVisible();
  await expect.poll(async () => (await offline.locator('.status').innerText()).trim()).not.toBe(statusInPolish);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  expect(aiWriteRequests, 'Changing language must not trigger an AI operation').toEqual([]);
});
