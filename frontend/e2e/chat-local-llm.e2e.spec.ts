import { expect, test } from '@playwright/test';

/** IPC contract test. Real GPU/model integration is verified by manual smoke testing. */
test('chat renders the local-model reply and does not invent text', async ({ page }) => {
  await page.addInitScript(() => {
    const id = '11111111-1111-4111-8111-111111111111';
    const now = '2026-11-09T20:00:00Z';
    const convo = { id, title: 'Nowa rozmowa', createdAt: now, updatedAt: now };
    (window as any).jarvisDesktop = {
      chatApi: async (req: { operation: string; content?: string }) => {
        if (req.operation === 'list') return { ok: true, status: 200, data: [convo] };
        if (req.operation === 'messages') return { ok: true, status: 200, data: [] };
        if (req.operation === 'send') return { ok: true, status: 200, data: {
          userMessage: { id: 'u1', conversationId: id, role: 'USER', content: req.content, createdAt: now, order: 1 },
          assistantMessage: { id: 'a1', conversationId: id, role: 'ASSISTANT', content: 'Angular Signals umożliwiają reaktywne przechowywanie stanu.', createdAt: now, order: 2 },
        } };
        return { ok: false, status: 400, error: 'UNSUPPORTED_OPERATION' };
      },
    };
  });
  await page.goto('/');
  await expect(page.getByTestId('chat-model-mode')).toContainText('Qwen3 8B');
  await page.getByTestId('chat-input').fill('Wyjaśnij Angular Signals');
  await page.getByTestId('chat-send').click();
  await expect(page.locator('.message--assistant').last()).toContainText('Angular Signals umożliwiają reaktywne');
});

test('chat preserves draft on Qwen unavailable response', async ({ page }) => {
  await page.addInitScript(() => {
    const id = '11111111-1111-4111-8111-111111111111';
    const now = '2026-11-09T20:00:00Z';
    const convo = { id, title: 'Nowa rozmowa', createdAt: now, updatedAt: now };
    (window as any).jarvisDesktop = { chatApi: async (req: { operation: string }) => {
      if (req.operation === 'list') return { ok: true, status: 200, data: [convo] };
      if (req.operation === 'messages') return { ok: true, status: 200, data: [] };
      return { ok: false, status: 503, error: 'LLM_NOT_READY' };
    }};
  });
  await page.goto('/');
  await page.getByTestId('chat-input').fill('Cześć Jarvis');
  await page.getByTestId('chat-send').click();
  await expect(page.getByRole('alert')).toContainText('Model Qwen3 8B nie jest dostępny');
  await expect(page.getByTestId('chat-input')).toHaveValue('Cześć Jarvis');
  await expect(page.locator('.message--assistant')).toHaveCount(0);
});
