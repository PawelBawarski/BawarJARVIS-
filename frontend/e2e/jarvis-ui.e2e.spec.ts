import { test, expect } from '@playwright/test';

test('should open custom confirmation dialog when deleting chat', async ({ page }) => {
  await page.goto('/');

  await page
    .getByRole('button', {
      name: 'Usuń czat',
    })
    .click();

  const dialog = page.getByRole('alertdialog', {
    name: 'Usunąć rozmowę?',
  });

  await expect(dialog).toBeVisible();

  await expect(
    dialog.getByText('Tej operacji nie można cofnąć.', {
      exact: false,
    }),
  ).toBeVisible();

  await dialog
    .getByRole('button', {
      name: 'Anuluj',
    })
    .click();

  await expect(dialog).not.toBeVisible();
});
