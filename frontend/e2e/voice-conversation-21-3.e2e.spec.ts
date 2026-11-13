import { expect, test } from '@playwright/test';

/** Browser-based end-to-end simulation: no real microphone, Qwen or Piper required. */
test('21.3: manual default, opt-in Whisper -> Chat POST -> Piper, then stop', async ({ page }) => {
  await page.addInitScript(() => {
    const now = new Date().toISOString();
    const chat = { id: 'c-voice-213', title: 'Voice conversation', createdAt: now, updatedAt: now };
    (window as any).__sendCount = 0;
    (window as any).__mockVoiceNode = undefined;
    (window as any).jarvisDesktop = { chatApi: async (req: { operation: string; content?: string }) => {
      if (req.operation === 'list') return { ok: true, status: 200, data: [chat] };
      if (req.operation === 'modelStatus') return { ok: true, status: 200, data: { ready: true, model: 'qwen' } };
      if (req.operation === 'messages') return { ok: true, status: 200, data: [] };
      if (req.operation === 'send') {
        (window as any).__sendCount++;
        return { ok: true, status: 200, data: {
          userMessage: { id: 'u-voice', conversationId: chat.id, role: 'USER', content: req.content, createdAt: now, order: 1 },
          assistantMessage: { id: 'a-voice', conversationId: chat.id, role: 'ASSISTANT', content: 'Lokalna odpowiedź Qwen', createdAt: now, order: 2 },
        } };
      }
      return { ok: false, status: 503, error: 'unavailable' };
    } };
    const fakeStream = { getTracks: () => [{ stop() {} }] };
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
      getUserMedia: async () => fakeStream,
    } });
    class FakeAudioContext {
      sampleRate = 16_000;
      destination = {};
      constructor(_options: unknown) {}
      createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
      createScriptProcessor() {
        const node = { onaudioprocess: null as ((event: any) => void) | null, connect() {}, disconnect() {} };
        (window as any).__mockVoiceNode = node;
        return node;
      }
      createGain() { return { gain: { value: 0 }, connect() {}, disconnect() {} }; }
      close() { return Promise.resolve(); }
    }
    (window as any).AudioContext = FakeAudioContext;
    (window as any).__ttsPlaying = false;
    (window as any).Audio = class {
      paused = true;
      onended: (() => void) | null = null;
      constructor(_url: string) {}
      async play() { this.paused = false; (window as any).__ttsPlaying = true; }
      pause() { this.paused = true; (window as any).__ttsPlaying = false; }
      load() {}
      removeAttribute(_attribute: string) {}
    };
    URL.createObjectURL = () => 'blob:voice-213';
    URL.revokeObjectURL = () => {};
  });
  await page.route('**/api/ai-lab/voice/status', route => route.fulfill({ json: {
    enabled: true, configured: true,
  } }));
  await page.route('**/api/ai-lab/voice/transcribe', route => route.fulfill({ json: {
    text: 'Jak działa silnik?', language: 'pl',
  } }));
  await page.route('**/api/ai-lab/tts/status', route => route.fulfill({ json: {
    enabled: true, configuredPl: true, configuredEn: true,
  } }));
  const requests: string[] = [];
  const audio = Buffer.alloc(48);
  audio.write('RIFF', 0);
  audio.write('WAVE', 8);
  await page.route('**/api/ai-lab/tts/synthesize', route => {
    requests.push((route.request().postDataJSON() as { text: string }).text);
    return route.fulfill({ contentType: 'audio/wav', body: audio });
  });
  await page.goto('/chat');
  await expect(page.getByTestId('voice-conversation-toggle')).toBeEnabled();
  await expect(page.getByTestId('voice-conversation-toggle')).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => (window as any).__sendCount)).toBe(0);
  expect(requests).toHaveLength(0);

  await page.getByTestId('voice-conversation-toggle').click();
  await expect(page.getByTestId('voice-conversation-toggle')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('voice-start').click();
  await page.evaluate(() => (window as any).__mockVoiceNode.onaudioprocess({
    inputBuffer: { getChannelData: () => new Float32Array(8_192).fill(0.2) },
  }));
  await page.getByTestId('voice-stop').click();
  await expect(page.getByTestId('chat-messages')).toContainText('Lokalna odpowiedź Qwen');
  await expect.poll(() => requests.length).toBe(1);
  expect(requests).toEqual(['Lokalna odpowiedź Qwen']);
  expect(await page.evaluate(() => (window as any).__sendCount)).toBe(1);
  await expect.poll(() => page.evaluate(() => (window as any).__ttsPlaying)).toBe(true);
  await page.getByTestId('voice-conversation-stop').click();
  await expect.poll(() => page.evaluate(() => (window as any).__ttsPlaying)).toBe(false);
  await page.getByTestId('voice-conversation-toggle').click();
  await expect(page.getByTestId('voice-conversation-toggle')).toHaveAttribute('aria-pressed', 'false');
});
