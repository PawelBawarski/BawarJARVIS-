import { expect, test } from '@playwright/test';

test('scrolls to a submitted question and to Qwen reply; clears composer and hides typing indicator', async ({ page }) => {
  await page.addInitScript(() => {
    const id = '8ef71522-27d0-4f9b-9bb3-d0245b9bf440';
    const chat = { id, title: 'Historia', createdAt: '2026-11-10T08:00:00Z', updatedAt: '2026-11-10T08:00:00Z' };
    const history = Array.from({ length: 32 }, (_, i) => ({
      id: `8ef71522-27d0-4f9b-9bb3-${String(i + 10).padStart(12, '0')}`,
      conversationId: id, role: i % 2 ? 'ASSISTANT' : 'USER',
      content: 'Poprzednia wiadomosc ' + i + ' '.repeat(6) + 'x'.repeat(220),
      createdAt: '2026-11-10T08:00:00Z', order: i + 1,
    }));
    (window as any).jarvisDesktop = {
      ...((window as any).jarvisDesktop || {}),
      chatApi: async (request: { operation: string }) => {
        if (request.operation === 'list') return { ok: true, status: 200, data: [chat] };
        if (request.operation === 'messages') return { ok: true, status: 200, data: history };
        if (request.operation === 'send') {
          return await new Promise(resolve => {
            (window as any).__completeJarvisSend = () => resolve({ ok: true, status: 200, data: {
              userMessage: {
                id: '8ef71522-27d0-4f9b-9bb3-000000004100', conversationId: id,
                role: 'USER', content: 'Nowe pytanie', createdAt: '2026-11-10T08:02:00Z', order: 33,
              },
              assistantMessage: {
                id: '8ef71522-27d0-4f9b-9bb3-000000004101', conversationId: id,
                role: 'ASSISTANT', content: 'Nowa odpowiedz Qwen', createdAt: '2026-11-10T08:02:01Z', order: 34,
              },
            } });
          });
        }
        return { ok: false, status: 400, error: 'UNSUPPORTED' };
      },
    };
  });
  await page.goto('/');
  const scroller = page.getByTestId('chat-messages');
  const input = page.getByTestId('chat-input');
  await expect(scroller.locator('.message')).toHaveCount(32);
  const isAtBottom = () => scroller.evaluate((element: HTMLElement) =>
    element.scrollTop + element.clientHeight >= element.scrollHeight - 4);
  await scroller.evaluate((element: HTMLElement) => { element.scrollTop = 0; });
  await input.fill('Nowe pytanie');
  await input.press('Enter');
  await expect(page.getByTestId('chat-pending-message')).toContainText('Nowe pytanie');
  await expect(page.getByTestId('chat-typing')).toBeVisible();
  await expect(input).toHaveValue('');
  await expect.poll(isAtBottom).toBe(true);
  await scroller.evaluate((element: HTMLElement) => { element.scrollTop = 0; });
  await page.evaluate(() => (window as any).__completeJarvisSend());
  await expect(scroller.locator('.message--assistant').last()).toContainText('Nowa odpowiedz Qwen');
  await expect(page.getByTestId('chat-typing')).toHaveCount(0);
  await expect(page.getByTestId('chat-pending-message')).toHaveCount(0);
  await expect.poll(isAtBottom).toBe(true);
  await expect(input).toBeFocused();
});
