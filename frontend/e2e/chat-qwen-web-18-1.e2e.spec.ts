import { test, expect } from '@playwright/test';

test('web Chat shows real model readiness and can refresh without Electron IPC', async ({ page }) => {
  let ready = false;
  await page.route('**/api/chats**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/chats/model-status') {
      await route.fulfill({contentType:'application/json',body:JSON.stringify({model:'jarvis-qwen3-8b',ready})});
    } else if (url.pathname === '/api/chats') {
      await route.fulfill({contentType:'application/json',body:'[]'});
    } else { await route.continue(); }
  });
  await page.goto('/');
  await expect(page.getByTestId('chat-model-status')).toContainText(/niedostępny|unavailable/);
  ready = true;
  await page.getByTestId('chat-model-refresh').click();
  await expect(page.getByTestId('chat-model-status')).toContainText(/gotowy|ready/);
});

test('web Chat preserves unsent draft when Qwen is unavailable (503)', async ({ page }) => {
  const chatId = '22222222-2222-4222-8222-222222222222';
  const now = '2026-11-12T16:00:00Z';
  await page.route('**/api/chats**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/api/chats/model-status') {
      await route.fulfill({contentType:'application/json', body:JSON.stringify({model:'jarvis-qwen3-8b',ready:false})});
    } else if (request.method() === 'GET' && url.pathname === '/api/chats') {
      await route.fulfill({contentType:'application/json', body:'[]'});
    } else if (request.method() === 'POST' && url.pathname === '/api/chats') {
      await route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({id:chatId,title:'Nowa rozmowa',createdAt:now,updatedAt:now})});
    } else if (request.method() === 'POST' && url.pathname === `/api/chats/${chatId}/messages`) {
      await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({code:'LLM_NOT_READY',message:'Model offline'})});
    } else { await route.fulfill({status:404,body:'{}'}); }
  });
  await page.goto('/');
  await page.getByTestId('chat-input').fill('Witaj, Qwen');
  await page.getByTestId('chat-send').click();
  await expect(page.getByTestId('chat-input')).toHaveValue('Witaj, Qwen');
  await expect(page.getByRole('alert')).toContainText(/Qwen3 8B.*(nie jest dostępny|unavailable)/);
  await expect(page.locator('.message--assistant')).toHaveCount(0);
});
