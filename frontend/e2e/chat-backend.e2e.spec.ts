import { test, expect } from '@playwright/test';

test('Angular -> IPC -> chat API: create conversation and display both server messages', async ({ page }) => {
  await page.addInitScript(() => {
    const chats: Array<{ id: string; title: string; createdAt: string; updatedAt: string }> = [];
    const messages: Record<string, Array<{ id: string; conversationId: string; role: string; content: string; createdAt: string; order: number }>> = {};
    Object.defineProperty(window, 'jarvisDesktop', {
      configurable: true, value: {
        checkPrivateHealth: async () => ({ status: 'authenticated' }),
        chatApi: async (req: { operation: string; id?: string; title?: string; content?: string }) => {
          let data: unknown = null;
          const now = new Date().toISOString();
          if (req.operation === 'list') data = [...chats];
          else if (req.operation === 'create') {
            const chat = { id: '11111111-1111-4111-8111-111111111111', title: req.title || 'Nowa rozmowa', createdAt: now, updatedAt: now };
            chats.push(chat); data = chat;
          } else if (req.operation === 'messages') data = messages[req.id!] || [];
          else if (req.operation === 'send') {
            const current = messages[req.id!] || [];
            const pair = [
              { id: '22222222-2222-4222-8222-222222222222', conversationId: req.id!, role: 'USER', content: req.content!, createdAt: now, order: current.length+1 },
              { id: '33333333-3333-4333-8333-333333333333', conversationId: req.id!, role: 'ASSISTANT', content: 'Odpowiedź z backendu', createdAt: now, order: current.length+2 },
            ];
            messages[req.id!] = [...current, ...pair];
            data = { userMessage: pair[0], assistantMessage: pair[1] };
          } else if (req.operation === 'delete') {
            const i = chats.findIndex(c => c.id === req.id);
            if (i >= 0) chats.splice(i, 1);
            data = null;
          }
          return { ok: true, status: 200, data };
        },
      },
    });
  });
  await page.goto('/');
  const input = page.getByTestId('chat-input');
  await expect(input).toBeVisible();
  await input.fill('Witaj Jarvis');
  await page.getByTestId('chat-send').click();
  await expect(page.locator('.message--user')).toContainText('Witaj Jarvis');
  await expect(page.locator('.message--assistant')).toContainText('Odpowiedź z backendu');
});
