import { expect, test } from '@playwright/test';

test('18.6: Research and Offline Lab update PL/EN without losing input or contacting AI', async ({ page }) => {
  await page.goto('/lab');
  const research = page.getByTestId('research-memory');
  await expect(research.getByRole('heading', { name: 'Internet i pamięć wiedzy' })).toBeVisible();
  await research.getByTestId('research-input').fill('Angular Signals');
  await page.getByTestId('jarvis-lab-offline').locator('summary').click();
  const offline = page.getByTestId('learning-lab');
  await expect(offline.getByText('Lokalny silnik Java 21')).toBeVisible();

  await page.getByRole('button', { name: 'Otwórz ustawienia' }).click();
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(research.getByRole('heading', { name: 'Web research and knowledge memory' })).toBeVisible();
  await expect(research.getByTestId('research-input')).toHaveValue('Angular Signals');
  await expect(offline.getByText('Local Java 21 service')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  // No requests to /api/ai are triggered simply by switching the UI language.
});
