import { test, expect } from '@playwright/test';

/** Simulates local engine downtime and recovery. No microphone, Chat POST or synthesis. */
test('21.4 manual health check detects offline Piper and recovers on refresh', async ({ page }) => {
  await page.addInitScript(() => {
    const now = new Date().toISOString();
    const chat = { id: 'health-chat', title: 'Voice diagnostics', createdAt: now, updatedAt: now };
    (window as any).__healthChatPosts = 0;
    (window as any).jarvisDesktop = { chatApi: async (request: { operation: string }) => {
      if (request.operation === 'list') return { ok: true, status: 200, data: [chat] };
      if (request.operation === 'messages') return { ok: true, status: 200, data: [] };
      if (request.operation === 'modelStatus') return {
        ok: true, status: 200, data: { model: 'qwen', ready: true },
      };
      (window as any).__healthChatPosts++;
      return { ok: false, status: 503, error: 'not available' };
    } };
  });
  let whisperChecks = 0;
  let piperChecks = 0;
  let speechPosts = 0;
  await page.route('**/api/ai-lab/voice/status', route => {
    whisperChecks++;
    return route.fulfill({ json: { enabled: true, configured: true } });
  });
  await page.route('**/api/ai-lab/tts/status', route => {
    piperChecks++;
    return route.fulfill({ json: {
      enabled: piperChecks > 1, configuredPl: piperChecks > 1, configuredEn: piperChecks > 1,
    } });
  });
  await page.route('**/api/ai-lab/tts/synthesize', route => {
    speechPosts++;
    return route.fulfill({ status: 503 });
  });
  await page.goto('/chat');
  const button = page.getByTestId('voice-health-refresh');
  await expect(button).toBeVisible();
  // The ChatVoice component may check Whisper status automatically; diagnostics must not check Piper.
  expect(piperChecks).toBe(0);
  await button.click();
  const results = page.getByTestId('voice-health-results');
  await expect(results.locator('[data-health="offline"]')).toHaveCount(2);
  await expect(results.locator('[data-health="ready"]')).toHaveCount(2);
  await button.click();
  await expect(results.locator('[data-health="ready"]')).toHaveCount(4);
  expect(piperChecks).toBe(2);
  expect(whisperChecks).toBeGreaterThanOrEqual(2);
  expect(speechPosts).toBe(0);
  expect(await page.evaluate(() => (window as any).__healthChatPosts)).toBe(0);
});
