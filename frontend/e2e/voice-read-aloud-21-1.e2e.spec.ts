import { expect, test } from '@playwright/test';

test('21.1: loading existing assistant messages never starts speech automatically', async ({ page }) => {
  let generated = 0;
  await page.addInitScript(() => {
    const now = new Date().toISOString();
    const chat = { id: 'speech-21-1', title: 'Read aloud', createdAt: now, updatedAt: now };
    (window as any).jarvisDesktop = { chatApi: async (r: { operation: string }) => {
      if (r.operation === 'list') return { ok: true, status: 200, data: [chat] };
      if (r.operation === 'messages') return { ok: true, status: 200, data: [
        { id: 'old-reply', conversationId: chat.id, role: 'ASSISTANT', content: 'Historia czatu', createdAt: now, order: 1 },
      ] };
      if (r.operation === 'modelStatus') return { ok: true, status: 200, data: { ready: true } };
      return { ok: false, status: 503 };
    }};
  });
  await page.route('**/api/ai-lab/tts/synthesize', route => {
    generated++;
    return route.fulfill({ status: 200, contentType: 'audio/wav', body: Buffer.alloc(48) });
  });
  await page.goto('/chat');
  await expect(page.locator('.message--assistant')).toContainText('Historia czatu');
  await expect(page.getByTestId('tts-read')).toHaveCount(0);
  await page.getByTestId('chat-tools-toggle').click();
  await expect(page.getByTestId('chat-auto-read')).toHaveAttribute('aria-pressed', 'false');
  expect(generated).toBe(0);
  await page.getByTestId('chat-auto-read').click();
  await expect(page.getByTestId('chat-auto-read')).toHaveAttribute('aria-pressed', 'true');
  expect(generated).toBe(0);
});
