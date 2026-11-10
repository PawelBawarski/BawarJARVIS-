import { expect, test } from '@playwright/test';

test('the application exposes only the four retained modules', async ({ page }) => {
  await page.goto('/');
  const menu = page.locator('select').filter({ has: page.locator('option[value="chat"]') }).first();
  await expect(menu).toBeVisible();
  const ids = await menu.locator('option').evaluateAll(options =>
    options.map(option => (option as HTMLOptionElement).value).filter(Boolean),
  );
  expect(new Set(ids)).toEqual(new Set(['chat', 'lab', 'radio', 'security']));
  await menu.selectOption('radio');
  await expect(menu).toHaveValue('radio');
  await menu.selectOption('security');
  await expect(menu).toHaveValue('security');
  await menu.selectOption('chat');
  await expect(page.getByTestId('chat-messages')).toBeVisible();
});
