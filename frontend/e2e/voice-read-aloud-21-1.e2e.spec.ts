import { test, expect } from '@playwright/test';

test('21.1 Piper is never called until clicking Read aloud for an assistant message', async ({ page }) => {
  await page.addInitScript(() => {
    const now = new Date().toISOString();
    const chat = { id: 'c-1', title: 'Voice Test', createdAt: now, updatedAt: now };
    (window as any).jarvisDesktop = { chatApi: async (r: { operation: string }) => {
      if (r.operation === 'list') return { ok: true, status: 200, data: [chat] };
      if (r.operation === 'modelStatus') return { ok: true, status: 200, data: { model: 'qwen', ready: true } };
      if (r.operation === 'messages') return { ok: true, status: 200, data: [{
        id: 'm-1', conversationId: chat.id, role: 'ASSISTANT',
        content: 'Witaj! Jestem lokalnym Jarvisem.', createdAt: now, order: 1,
      }] };
      return { ok: false, status: 503, error: 'unavailable' };
    } };
    (window as any).Audio = class {
      paused = true;
      constructor(_url: string) {}
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
  let generated = 0;
  const audio = Buffer.alloc(48);
  audio.write('RIFF', 0);
  audio.write('WAVE', 8);
  await page.route('**/api/ai-lab/tts/synthesize', route => {
    generated++;
    expect(route.request().method()).toBe('POST');
    return route.fulfill({ status: 200, contentType: 'audio/wav', body: audio });
  });
  await page.goto('/chat');
  await expect(page.locator('.message--assistant')).toContainText('lokalnym Jarvisem');
  const read = page.getByTestId('tts-read');
  await expect(read).toBeEnabled();
  expect(generated).toBe(0);
  await read.click();
  await expect(page.getByTestId('tts-stop')).toBeVisible();
  expect(generated).toBe(1);
  await page.getByTestId('tts-stop').click();
  await expect(read).toBeVisible();
  expect(generated).toBe(1);
});
