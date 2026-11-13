import { test, expect } from '@playwright/test';

test('20.4: Chat retrieval sources load only after click and are not labeled model citations', async ({ page }) => {
  const id = '11111111-1111-4111-8111-111111111111';
  await page.addInitScript((chatId) => {
    const now = '2026-11-13T12:00:00Z';
    (window as any).jarvisDesktop = {
      chatApi: async (request: { operation: string }) => {
        const chat = { id: chatId, title: 'RAG test', createdAt: now, updatedAt: now };
        const messages = [
          { id: '22222222-2222-4222-8222-222222222222', conversationId: chatId,
            role: 'USER', content: 'Czym są Angular Signals?', createdAt: now, order: 1 },
          { id: '33333333-3333-4333-8333-333333333333', conversationId: chatId,
            role: 'ASSISTANT', content: 'Reaktywna zmiana stanu.', createdAt: now, order: 2 }
        ];
        if (request.operation === 'list') return { ok: true, status: 200, data: [chat] };
        if (request.operation === 'messages') return { ok: true, status: 200, data: messages };
        if (request.operation === 'modelStatus') return { ok: true, status: 200, data: { ready: true, model: 'qwen' } };
        return { ok: false, status: 400, error: 'unsupported' };
      }
    };
  }, id);
  let calls = 0;
  await page.route('**/api/research/context/preview', async route => {
    expect(route.request().method()).toBe('POST');
    expect(route.request().postDataJSON()).toEqual({ question: 'Czym są Angular Signals?' });
    calls++;
    await route.fulfill({ json: { query: 'Czym są Angular Signals?', snapshotOfAnswer: false, sources: [
      { id: 'a', title: 'Angular Signals', excerpt: 'Reactive state management', method: 'semantic',
        externalUrl: 'https://example.org/guide', local: false }
    ] } });
  });
  await page.goto('/chat');
  await expect(page.getByTestId('chat-rag-sources')).toBeVisible();
  expect(calls).toBe(0);
  await page.getByTestId('chat-rag-inspect').click();
  await expect(page.getByTestId('chat-rag-list')).toContainText('Angular Signals');
  await expect(page.getByTestId('chat-rag-list')).toContainText('Reactive state management');
  await expect(page.locator('.rag-sources__notice')).toBeVisible();
  expect(calls).toBe(1);
});
