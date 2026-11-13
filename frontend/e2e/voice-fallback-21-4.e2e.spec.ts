import { expect, test } from '@playwright/test';

/** No silent retry on Chat failure; the transcript remains editable after consented STT. */
test('21.4 Whisper result survives failed Qwen POST and Piper is never started', async ({ page }) => {
  await page.addInitScript(() => {
    const now = new Date().toISOString();
    const chat = { id: 'voice-failure', title: 'Voice failure', createdAt: now, updatedAt: now };
    (window as any).__failedSendCount = 0;
    (window as any).jarvisDesktop = { chatApi: async (request: { operation: string }) => {
      if (request.operation === 'list') return { ok: true, status: 200, data: [chat] };
      if (request.operation === 'messages') return { ok: true, status: 200, data: [] };
      if (request.operation === 'modelStatus') return {
        ok: true, status: 200, data: { ready: true, model: 'qwen' },
      };
      if (request.operation === 'send') {
        (window as any).__failedSendCount++;
        return { ok: false, status: 503, error: 'LLM_NOT_READY' };
      }
      return { ok: false, status: 503, error: 'offline' };
    } };
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
      getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }),
    } });
    class FakeAudioContext {
      sampleRate = 16_000;
      destination = {};
      constructor(_config: unknown) {}
      createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
      createScriptProcessor() {
        const result = { onaudioprocess: null as ((event: any) => void) | null,
          connect() {}, disconnect() {} };
        (window as any).__errorVoiceNode = result;
        return result;
      }
      createGain() { return { gain: { value: 0 }, connect() {}, disconnect() {} }; }
      close() { return Promise.resolve(); }
    }
    (window as any).AudioContext = FakeAudioContext;
  });
  await page.route('**/api/ai-lab/voice/status', route => route.fulfill({ json: {
    enabled: true, configured: true,
  } }));
  await page.route('**/api/ai-lab/voice/transcribe', route => route.fulfill({ json: {
    text: 'Sprawdź silnik', language: 'pl',
  } }));
  let synthCount = 0;
  await page.route('**/api/ai-lab/tts/synthesize', route => {
    synthCount++;
    return route.fulfill({ status: 503 });
  });
  await page.goto('/chat');
  await page.getByTestId('voice-conversation-toggle').click();
  await page.getByTestId('voice-start').click();
  await page.evaluate(() => (window as any).__errorVoiceNode.onaudioprocess({
    inputBuffer: { getChannelData: () => new Float32Array(8_192).fill(0.1) },
  }));
  await page.getByTestId('voice-stop').click();
  await expect(page.getByTestId('chat-input')).toHaveValue('Sprawdź silnik');
  await expect.poll(() => page.evaluate(() => (window as any).__failedSendCount)).toBe(1);
  expect(synthCount).toBe(0);
  await expect(page.getByTestId('voice-conversation-toggle')).toHaveAttribute('aria-pressed', 'true');
});
