import { expect, test } from '@playwright/test';

/** UI contract only: the real Java reply engine is tested separately. */
test('Chat displays a readable response from IPC instead of invented frontend text', async ({ page }) => {
  await page.addInitScript(() => {
    const id = '11111111-1111-4111-8111-111111111111';
    let counter = 0;
    const now = '2026-11-09T18:00:00Z';
    (window as any).jarvisDesktop = {
      chatApi: async (request: { operation: string; content?: string }) => {
        const conversation = { id, title: 'Nowa rozmowa', createdAt: now, updatedAt: now };
        if (request.operation === 'list') return { ok: true, status: 200, data: [conversation] };
        if (request.operation === 'messages') return { ok: true, status: 200, data: [] };
        if (request.operation === 'create') return { ok: true, status: 201, data: conversation };
        if (request.operation === 'send') {
          counter++;
          const response = request.content === 'Cześć'
            ? 'Cześć! Jestem J.A.R.V.I.S. W tym trybie działam lokalnie.'
            : 'Nie mam jeszcze wiarygodnej odpowiedzi na to pytanie.';
          return { ok: true, status: 200, data: {
            userMessage: { id: `user-${counter}`, conversationId: id, role: 'USER', content: request.content, createdAt: now, order: counter * 2 - 1 },
            assistantMessage: { id: `assistant-${counter}`, conversationId: id, role: 'ASSISTANT', content: response, createdAt: now, order: counter * 2 },
          }};
        }
        return { ok: false, status: 400, error: 'UNSUPPORTED_OPERATION' };
      },
    };
  });
  await page.goto('/');
  await expect(page.getByTestId('chat-input')).toBeVisible();
  await expect(page.getByTestId('chat-model-mode')).toContainText('Qwen3 8B');
  await page.getByTestId('chat-input').fill('Cześć');
  await page.getByTestId('chat-send').click();
  await expect(page.locator('.message--assistant').last()).toContainText('Cześć! Jestem J.A.R.V.I.S.');
  await page.getByTestId('chat-input').fill('Czy umiesz przewidzieć pogodę?');
  await page.getByTestId('chat-send').click();
  await expect(page.locator('.message--assistant').last()).toContainText('Nie mam jeszcze wiarygodnej odpowiedzi');
  await expect(page.locator('.message--user')).toHaveCount(2);
});
