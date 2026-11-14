import { expect, test } from '@playwright/test';

test('M04: Chat displays user and assistant messages from HTTP DTOs', async ({ page }) => {
  const chatId = '11111111-1111-4111-8111-111111111111';
  const now = '2026-11-14T12:00:00Z';
  let sends = 0;
  await page.route('**/api/chats**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    let status = 200;
    let body: unknown = [];
    if (path === '/api/chats' && method === 'GET') body = [];
    else if (path === '/api/chats' && method === 'POST') {
      status = 201;
      body = { id: chatId, title: 'Nowa rozmowa', createdAt: now, updatedAt: now };
    } else if (path === `/api/chats/${chatId}/messages` && method === 'POST') {
      sends++;
      const { content } = request.postDataJSON() as { content: string };
      body = {
        userMessage: { id: 'u1', conversationId: chatId, role: 'USER', content, createdAt: now, order: 1 },
        assistantMessage: { id: 'a1', conversationId: chatId, role: 'ASSISTANT', content: 'Odpowiedź z backendu', createdAt: now, order: 2 },
      };
    }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/chat');
  const draft = page.getByTestId('chat-input');
  await draft.fill('Pytanie do Jarvisa');
  await page.getByTestId('chat-send').click();
  await expect(page.locator('.message--assistant')).toContainText('Odpowiedź z backendu');
  await expect(page.getByText('Pytanie do Jarvisa')).toBeVisible();
  expect(sends).toBe(1);
});
