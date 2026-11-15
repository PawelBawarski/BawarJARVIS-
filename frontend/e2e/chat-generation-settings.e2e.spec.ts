import { expect, test } from '@playwright/test';

test('Chat AI token limit: min/max, validation, saved value, and AI Lab separation', async ({ page }) => {
  let stored = 384;
  await page.route('**/api/chats/generation-settings', async route => {
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON() as {chatMaxTokens: number};
      if (!Number.isInteger(body.chatMaxTokens) || body.chatMaxTokens < 64 || body.chatMaxTokens > 1024) {
        await route.fulfill({status: 400, json: {message:'Invalid'}}); return;
      }
      stored = body.chatMaxTokens;
    }
    await route.fulfill({json: {chatMaxTokens: stored, minTokens: 64, maxTokens: 1024}});
  });
  await page.goto('/');
  await page.getByTestId('open-settings').click();
  await page.getByTestId('settings-chat-ai-heading').click();
  const input = page.getByTestId('settings-chat-max-tokens');
  const save = page.getByTestId('settings-chat-token-save');
  await expect(input).toHaveValue('384');
  await expect(input).toHaveAttribute('min', '64');
  await expect(input).toHaveAttribute('max', '1024');
  await input.fill('1025');
  await expect(save).toBeDisabled();
  await input.fill('512');
  await save.click();
  await expect(input).toHaveValue('512');
  expect(stored).toBe(512);
  await page.reload();
  await page.getByTestId('open-settings').click();
  await page.getByTestId('settings-chat-ai-heading').click();
  await expect(page.getByTestId('settings-chat-max-tokens')).toHaveValue('512');
  await expect(page.getByTestId('settings-chat-ai-section')).toContainText('Czat AI');
});
