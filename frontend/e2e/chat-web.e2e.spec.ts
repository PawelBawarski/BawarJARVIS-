import { expect, test } from '@playwright/test';

test('browser-only Chat saves a turn through the HTTP API', async ({ page }) => {
  const chatId = '11111111-1111-4111-8111-111111111111';
  const now = '2026-11-11T20:00:00Z';
  const conversation = { id: chatId, title: 'Nowa rozmowa', createdAt: now, updatedAt: now };
  await page.route('**/api/chats**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    let body: unknown;
    let status = 200;
    if (path === '/api/chats' && request.method() === 'GET') body = [];
    else if (path === '/api/chats' && request.method() === 'POST') { body = conversation; status = 201; }
    else if (path === `/api/chats/${chatId}/messages` && request.method() === 'POST') {
      const input = request.postDataJSON() as {content:string};
      body = {
        userMessage: {id:'m1',conversationId:chatId,role:'USER',content:input.content,createdAt:now,order:1},
        assistantMessage: {id:'m2',conversationId:chatId,role:'ASSISTANT',content:'Odpowiedź z HTTP',createdAt:now,order:2},
      };
    } else body = [];
    await route.fulfill({ status, contentType:'application/json', body:JSON.stringify(body) });
  });
  await page.goto('/');
  await page.getByTestId('chat-input').fill('Witaj Jarvis');
  await page.getByTestId('chat-send').click();
  await expect(page.locator('.message--assistant')).toContainText('Odpowiedź z HTTP');
});
