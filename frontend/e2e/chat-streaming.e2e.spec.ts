import { test, expect } from '@playwright/test';

test('Chat shows incoming SSE tokens and provides Stop during generation', async ({ page }) => {
  const now = new Date().toISOString();
  const chat = { id:'11111111-1111-4111-8111-111111111111',title:'Nowa',createdAt:now,updatedAt:now };
  await page.route('**/api/chats', route => route.fulfill({json:[chat]}));
  await page.route('**/api/chats/*/messages', route => route.fulfill({json:[]}));
  await page.route('**/api/chats/model-status', route => route.fulfill({json:{model:'jarvis-qwen3-8b',ready:true}}));
  await page.route('**/api/chats/*/messages/stream?*', async route => {
    const response = 'event: delta\ndata: "Pierwszy fragment "\n\n' +
      'event: delta\ndata: "drugie zdanie."\n\n' +
      'event: done\ndata: '+JSON.stringify({
        userMessage:{id:'22222222-2222-4222-8222-222222222222',conversationId:chat.id,role:'USER',content:'Test',createdAt:now,order:1},
        assistantMessage:{id:'33333333-3333-4333-8333-333333333333',conversationId:chat.id,role:'ASSISTANT',content:'Pierwszy fragment drugie zdanie.',createdAt:now,order:2}
      })+'\n\n';
    await route.fulfill({status:200, contentType:'text/event-stream',body:response});
  });
  await page.goto('/');
  await page.getByTestId('chat-input').fill('Test');
  await page.getByTestId('chat-send').click();
  await expect(page.locator('.message--assistant')).toContainText('Pierwszy fragment drugie zdanie.');
  await expect(page.getByTestId('chat-stream-stop')).toHaveCount(0);
});
