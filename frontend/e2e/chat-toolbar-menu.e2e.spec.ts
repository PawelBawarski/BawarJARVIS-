import { test, expect } from '@playwright/test';

test('Chat header uses one aligned action menu, without per-message playback controls', async ({ page }) => {
  const now = new Date().toISOString();
  await page.addInitScript((createdAt) => {
    const chat = { id: 'chat-menu-1', title: 'Menu', createdAt, updatedAt: createdAt };
    (window as any).jarvisDesktop = { chatApi: async (request: { operation: string }) => {
      if (request.operation === 'list') return { ok: true, status: 200, data: [chat] };
      if (request.operation === 'messages') return { ok: true, status: 200, data: [
        { id: 'assistant-menu-1', conversationId: chat.id, role: 'ASSISTANT',
          content: 'Odpowiedź testowa', createdAt, order: 1 },
      ] };
      if (request.operation === 'modelStatus') return { ok: true, status: 200, data: { ready: true } };
      return { ok: false, status: 503, error: 'unavailable' };
    }};
  }, now);
  await page.goto('/chat');
  const toolbar = page.locator('.chat-header__actions');
  await expect(toolbar.getByTestId('chat-tools-toggle')).toBeVisible();
  await expect(toolbar.getByTestId('chat-tools-menu')).toBeHidden();
  await expect(page.locator('.message--assistant app-chat-speech')).toHaveCount(0);
  await expect(page.locator('.message--assistant').first().getByTestId('chat-copy-answer')).toBeVisible();
  await toolbar.getByTestId('chat-tools-toggle').click();
  await expect(toolbar.getByTestId('chat-tools-menu')).toBeVisible();
  await expect(toolbar.getByTestId('chat-auto-read')).toBeVisible();
  await expect(toolbar.getByTestId('voice-start')).toBeVisible();
  await expect(toolbar.getByTestId('chat-header-new')).toBeVisible();
  await expect(toolbar.getByTestId('chat-header-delete')).toBeVisible();
  await toolbar.getByTestId('chat-tools-backdrop').click({ position: { x: 5, y: 5 } });
  await expect(toolbar.getByTestId('chat-tools-menu')).toBeHidden();
});
