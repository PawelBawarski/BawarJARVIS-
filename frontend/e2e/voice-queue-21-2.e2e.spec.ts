import { test, expect } from '@playwright/test';

test('21.2 explicit speech: long reply, pause, resume, sequential parts and stop', async ({ page }) => {
  const answer = 'To jest długa odpowiedź Jarvisa. '.repeat(60);
  await page.addInitScript((message) => {
    const now = new Date().toISOString();
    const chat = { id: 'c-21-2', title: 'Voice queue', createdAt: now, updatedAt: now };
    (window as any).jarvisDesktop = { chatApi: async (r: { operation: string }) => {
      if (r.operation === 'list') return { ok: true, status: 200, data: [chat] };
      if (r.operation === 'modelStatus') return { ok: true, status: 200, data: { model: 'qwen', ready: true } };
      if (r.operation === 'messages') return { ok: true, status: 200, data: [{
        id: 'm-21-2', conversationId: chat.id, role: 'ASSISTANT', content: message,
        createdAt: now, order: 1,
      }] };
      return { ok: false, status: 503, error: 'unavailable' };
    } };
    (window as any).__fakeAudio = [];
    (window as any).Audio = class {
      paused = true;
      onended: (() => void) | null = null;
      constructor(_url: string) { (window as any).__fakeAudio.push(this); }
      async play() { this.paused = false; }
      pause() { this.paused = true; }
      load() {}
      removeAttribute(_name: string) {}
    };
    URL.createObjectURL = () => `blob:part-${(window as any).__fakeAudio.length}`;
    URL.revokeObjectURL = () => {};
  }, answer);
  await page.route('**/api/ai-lab/tts/status', route => route.fulfill({ json: {
    enabled: true, configuredPl: true, configuredEn: true,
  } }));
  const requests: string[] = [];
  const audio = Buffer.alloc(48);
  audio.write('RIFF', 0);
  audio.write('WAVE', 8);
  await page.route('**/api/ai-lab/tts/synthesize', route => {
    const body = route.request().postDataJSON() as { text: string; language: string };
    requests.push(body.text);
    expect(body.text.length).toBeLessThanOrEqual(650);
    return route.fulfill({ contentType: 'audio/wav', body: audio });
  });
  await page.goto('/chat');
  await expect(page.getByTestId('tts-read')).toBeEnabled();
  expect(requests).toHaveLength(0);
  await page.getByTestId('tts-read').click();
  await expect(page.getByTestId('tts-progress')).toContainText('1 /');
  await expect(page.getByTestId('tts-pause')).toBeVisible();
  expect(requests).toHaveLength(1);
  await page.getByTestId('tts-pause').click();
  await expect(page.getByTestId('tts-resume')).toBeVisible();
  expect(requests).toHaveLength(1);
  await page.getByTestId('tts-resume').click();
  await expect(page.getByTestId('tts-pause')).toBeVisible();
  expect(requests).toHaveLength(1);
  await page.evaluate(() => (window as any).__fakeAudio.at(-1).onended());
  await expect.poll(() => requests.length).toBe(2);
  await expect(page.getByTestId('tts-progress')).toContainText('2 /');
  await page.getByTestId('tts-stop').click();
  await expect(page.getByTestId('tts-read')).toBeVisible();
  expect(requests).toHaveLength(2);
});
