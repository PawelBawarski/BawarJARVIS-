import { expect, test } from '@playwright/test';

test('module help opens with steps, commands and closes via Escape', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('open-module-help').click();
  const dialog = page.getByRole('dialog', { name: /Czat AI/ });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('prepare_assets.py');
  await expect(dialog.getByRole('button', { name: /Kopiuj:/ }).first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('AI Lab help explains legacy Offline Brain and token source', async ({ page }) => {
  await page.goto('/');
  // Existing top module selector uses a native select with option label AI Lab.
  await page.getByRole('combobox').first().selectOption({ label: 'AI Lab' });
  await page.getByTestId('open-module-help').click();
  await expect(page.getByRole('dialog')).toContainText('8766');
  await page.getByRole('button', { name: 'Rozumiem — zamknij' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: /Jak działa AI Lab/ }).click();
  await expect(page.getByRole('dialog')).toContainText('Offline Brain');
});
