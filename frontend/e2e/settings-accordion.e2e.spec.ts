import { expect, test } from '@playwright/test';

test('Settings: General and AI Chat sections expand independently', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('open-settings').click();
  const general = page.getByTestId('settings-general-section');
  const chat = page.getByTestId('settings-chat-ai-section');
  await expect(general).toHaveAttribute('open', '');
  await expect(chat).not.toHaveAttribute('open', '');
  await expect(general.locator('.language-options')).toBeVisible();
  await expect(page.getByTestId('settings-internet-enabled')).toBeHidden();
  await page.getByTestId('settings-chat-ai-heading').click();
  await expect(chat).toHaveAttribute('open', '');
  await expect(page.getByTestId('settings-internet-enabled')).toBeVisible();
  await page.getByTestId('settings-general-heading').click();
  await expect(general).not.toHaveAttribute('open', '');
  await expect(chat).toHaveAttribute('open', '');
  await page.getByTestId('settings-chat-ai-heading').click();
  await expect(chat).not.toHaveAttribute('open', '');
});
