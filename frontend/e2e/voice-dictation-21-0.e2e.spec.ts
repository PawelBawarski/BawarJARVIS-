import { test, expect } from '@playwright/test';

test('21.0: dictated transcript fills Chat but never sends a message automatically', async ({ page }) => {
  await page.addInitScript(() => {
    const mock = { getTracks: () => [{ stop() {} }] };
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
      getUserMedia: async () => mock,
    } });
    class FakeAudio {
      sampleRate = 16000;
      destination = {};
      constructor(_config: unknown) {}
      createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
      createScriptProcessor() {
        const node = { onaudioprocess: null as ((event: any) => void) | null,
          connect() {}, disconnect() {} };
        (window as any).__voiceNode = node;
        return node;
      }
      createGain() { return { gain: { value: 0 }, connect() {}, disconnect() {} }; }
      close() { return Promise.resolve(); }
    }
    (window as any).AudioContext = FakeAudio;
    (window as any).jarvisDesktop = {
      chatApi: async (request: { operation: string }) => {
        if (request.operation === 'list') return { ok: true, status: 200, data: [] };
        if (request.operation === 'modelStatus') return { ok: true, status: 200,
          data: { ready: true, model: 'qwen' } };
        return { ok: false, status: 503, error: 'offline' };
      },
    };
  });
  await page.route('**/api/ai-lab/voice/status', route => route.fulfill({ json: {
    enabled: true, configured: true,
  } }));
  let transcriptions = 0;
  let messages = 0;
  await page.route('**/api/ai-lab/voice/transcribe', route => {
    transcriptions++;
    expect(route.request().method()).toBe('POST');
    return route.fulfill({ json: { text: 'Cześć Jarvis', language: 'pl' } });
  });
  await page.route('**/api/chats/**/messages', route => {
    if (route.request().method() === 'POST') messages++;
    return route.fulfill({ json: [] });
  });
  await page.goto('/chat');
  await expect(page.getByTestId('voice-start')).toBeEnabled();
  await page.getByTestId('voice-start').click();
  await expect(page.getByTestId('voice-stop')).toBeVisible();
  await page.evaluate(() => (window as any).__voiceNode.onaudioprocess({ inputBuffer: {
    getChannelData: () => new Float32Array(8_192).fill(0.2),
  } }));
  await page.getByTestId('voice-stop').click();
  await expect(page.getByTestId('chat-input')).toHaveValue('Cześć Jarvis');
  expect(transcriptions).toBe(1);
  expect(messages).toBe(0);
});

test('21.0: unavailable Whisper does not request microphone permission', async ({ page }) => {
  await page.route('**/api/ai-lab/voice/status', route => route.fulfill({ json: {
    enabled: false, configured: false,
  } }));
  await page.goto('/chat');
  await expect(page.getByTestId('voice-start')).toBeDisabled();
});
