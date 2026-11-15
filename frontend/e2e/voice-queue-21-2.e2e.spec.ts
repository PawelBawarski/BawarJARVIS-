import { expect, test } from '@playwright/test';

test('21.2: queue playback controls are not rendered in every answer bubble', async ({ page }) => {
  await page.addInitScript(() => {
    const now = new Date().toISOString();
    const chat = { id: 'voice-queue-21-2', title: 'Queue', createdAt: now, updatedAt: now };
    (window as any).jarvisDesktop = { chatApi: async (r: { operation: string }) => {
      if (r.operation === 'list') return { ok: true, status: 200, data: [chat] };
      if (r.operation === 'messages') return { ok: true, status: 200, data: [
        { id: 'long-reply', conversationId: chat.id, role: 'ASSISTANT',
          content: 'Długa odpowiedź. '.repeat(80), createdAt: now, order: 1 },
      ] };
      if (r.operation === 'modelStatus') return { ok: true, status: 200, data: { ready: true } };
      return { ok: false, status: 503 };
    }};
  });
  await page.goto('/chat');
  await expect(page.locator('.message--assistant')).toContainText('Długa odpowiedź');
  await expect(page.locator('.message--assistant app-chat-speech')).toHaveCount(0);
  await expect(page.getByTestId('tts-pause')).toHaveCount(0);
  await expect(page.getByTestId('tts-stop')).toHaveCount(0);
  await page.getByTestId('chat-tools-toggle').click();
  await expect(page.getByTestId('chat-auto-read')).toBeVisible();
});
