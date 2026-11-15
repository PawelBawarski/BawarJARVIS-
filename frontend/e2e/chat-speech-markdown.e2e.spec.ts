import { expect, test } from '@playwright/test';

test('Chat auto-read speaks formatted answer without Markdown symbols', async ({ page }) => {
  await page.addInitScript(() => {
    const now = new Date().toISOString();
    const chat = { id: 'speech-case', title: 'Speech', createdAt: now, updatedAt: now };
    (window as any).jarvisDesktop = { chatApi: async (r: { operation: string; content?: string }) => {
      if (r.operation === 'list') return { ok: true, status: 200, data: [chat] };
      if (r.operation === 'messages') return { ok: true, status: 200, data: [] };
      if (r.operation === 'modelStatus') return { ok: true, status: 200, data: { ready: true, model: 'qwen' } };
      if (r.operation === 'send') return { ok: true, status: 200, data: {
        userMessage: { id: 'm-user', conversationId: chat.id, role: 'USER', content: r.content, createdAt: now, order: 1 },
        assistantMessage: { id: 'm-reply', conversationId: chat.id, role: 'ASSISTANT',
          content: '**Ważne** i *krótko*.\n\n```ts\nconst code = 1;\n```', createdAt: now, order: 2 },
      } };
      return { ok: false, status: 503, error: 'unavailable' };
    } };
    (window as any).Audio = class {
      paused = true;
      async play() { this.paused = false; }
      pause() { this.paused = true; }
      load() {}
      removeAttribute(_name: string) {}
    };
    URL.createObjectURL = () => 'blob:fake-piper';
    URL.revokeObjectURL = () => {};
  });
  await page.route('**/api/ai-lab/tts/status', route => route.fulfill({ json: {
    enabled: true, configuredPl: true, configuredEn: true,
  } }));
  const spoken: string[] = [];
  const wav = Buffer.alloc(48);
  wav.write('RIFF', 0); wav.write('WAVE', 8);
  await page.route('**/api/ai-lab/tts/synthesize', route => {
    const payload = JSON.parse(route.request().postData() || '{}');
    spoken.push(payload.text);
    return route.fulfill({ status: 200, contentType: 'audio/wav', body: wav });
  });
  await page.goto('/chat');
  await page.getByTestId('chat-tools-toggle').click();
  await page.getByTestId('chat-auto-read').click();
  await page.getByTestId('chat-tools-toggle').click();
  await page.getByTestId('chat-input').fill('Test');
  await page.getByTestId('chat-send').click();
  await expect(page.locator('.message--assistant')).toContainText('Ważne');
  await expect.poll(() => spoken.length).toBe(1);
  expect(spoken[0]).toBe('Ważne i krótko. Fragment kodu.');
  // Markdown is unchanged on screen. Normalisation affects only spoken input.
  await expect(page.locator('.message--assistant strong')).toHaveText('Ważne');
});
