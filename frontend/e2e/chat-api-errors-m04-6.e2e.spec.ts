import { expect, test } from '@playwright/test';

test('M04.6: HTTP 400 preserves chat draft and does not retry POST', async ({ page }) => {
  const chatId = '11111111-1111-4111-8111-111111111111';
  const now = '2026-11-14T12:00:00Z';
  let sends = 0;

  await page.route('**/api/security/health', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{"status":"UP"}',
    }),
  );

  await page.route('**/api/chats**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (path === '/api/chats' && request.method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: chatId,
            title: 'Test M04',
            createdAt: now,
            updatedAt: now,
          },
        ]),
      });
    }

    if (path === `/api/chats/${chatId}/messages` && request.method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '[]',
      });
    }

    if (path === `/api/chats/${chatId}/messages` && request.method() === 'POST') {
      sends++;

      return route.fulfill({
        status: 400,
        contentType: 'application/json',
        headers: {
          'X-Request-Id': '11111111-1111-4111-8111-111111111111',
        },
        body: JSON.stringify({
          code: 'BAD_REQUEST',
          requestId: '11111111-1111-4111-8111-111111111111',
        }),
      });
    }

    return route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: '{"code":"NOT_FOUND"}',
    });
  });

  await page.goto('/chat');

  const draft = page.getByTestId('chat-input');
  const send = page.getByTestId('chat-send');

  // Empty draft must not be submitted.
  await expect(send).toBeDisabled();

  await draft.fill('Wiadomość testowa M04');
  await expect(send).toBeEnabled();

  await send.click();

  await expect(page.getByRole('alert')).toBeVisible();
  await expect(draft).toHaveValue('Wiadomość testowa M04');
  await expect(page.locator('.message--assistant')).toHaveCount(0);

  expect(sends).toBe(1);
});
