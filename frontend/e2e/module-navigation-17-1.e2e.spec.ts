import { expect, test } from '@playwright/test';

test('aplikacja udostępnia trzy zakładki i radio w pasku narzędzi', async ({ page }) => {
  await page.goto('/');
  const menu = page
    .locator('select')
    .filter({ has: page.locator('option[value="chat"]') })
    .first();
  await expect(menu).toBeVisible();
  const ids = await menu
    .locator('option')
    .evaluateAll((options) =>
      options.map((option) => (option as HTMLOptionElement).value).filter(Boolean),
    );
  expect(new Set(ids)).toEqual(new Set(['chat', 'lab', 'security']));
  await menu.selectOption('lab');
  await expect(page.getByTestId('jarvis-lab-ux')).toBeVisible();
  await menu.selectOption('security');
  await expect(menu).toHaveValue('security');

  const radioButton = page.locator('.shell__toolbar .radio-control__trigger');
  const radioPanel = page.locator('#jarvis-radio-panel');
  await expect(radioButton).toBeVisible();
  await expect(radioButton).toHaveAttribute('aria-expanded', 'false');
  await radioButton.click();
  await expect(radioButton).toHaveAttribute('aria-expanded', 'true');
  await expect(radioPanel).toBeVisible();
  await expect(radioPanel.locator('#radio-country')).toBeVisible();
  await expect(radioPanel.locator('#radio-station')).toBeVisible();
  await expect(menu).toHaveValue('security');
  await radioPanel.locator('.radio-panel__close').click();
  await expect(radioPanel).toHaveCount(0);
  await expect(radioButton).toHaveAttribute('aria-expanded', 'false');

  await menu.selectOption('chat');
  await expect(page.getByTestId('chat-messages')).toBeVisible();
});
