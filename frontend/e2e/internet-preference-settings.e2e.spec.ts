import { expect, test } from '@playwright/test';

test('Settings restores internet toggle from server and persists changes', async ({ page }) => {
  let enabled = true;
  await page.route('**/api/chats/web-settings', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ internetEnabled: enabled }) });
      return;
    }
    if (route.request().method() === 'PUT') {
      enabled = JSON.parse(route.request().postData() ?? '{}').internetEnabled === true;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ internetEnabled: enabled }) });
      return;
    }
    await route.continue();
  });
  await page.goto('/');
  // Existing Settings dialog is opened by the application's settings control.
  await page.getByTestId('open-settings').click();
  await page.getByTestId('settings-chat-ai-heading').click();
  const control = page.getByTestId('settings-internet-enabled');
  await expect(control).toHaveAttribute('aria-pressed', 'true');
  await control.click();
  await expect(control).toHaveAttribute('aria-pressed', 'false');
  await page.reload();
  await page.getByTestId('open-settings').click();
  await page.getByTestId('settings-chat-ai-heading').click();
  await expect(page.getByTestId('settings-internet-enabled')).toHaveAttribute('aria-pressed', 'false');
});
