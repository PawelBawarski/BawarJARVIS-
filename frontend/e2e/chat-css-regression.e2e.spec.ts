import { expect, test } from '@playwright/test';

test('chat preserves component styling and layout after recovery', async ({ page }) => {
  await page.addInitScript(() => {
    const chat = {
      id: '8ef71522-27d0-4f9b-9bb3-d0245b9bf440',
      title: 'Rozmowa testowa',
      createdAt: '2026-11-10T12:00:00Z',
      updatedAt: '2026-11-10T12:00:00Z',
    };
    const message = {
      id: '8ef71522-27d0-4f9b-9bb3-d0245b9bf441',
      conversationId: chat.id,
      role: 'USER', content: 'Test wyglądu',
      createdAt: '2026-11-10T12:01:00Z', order: 1,
    };
    (window as any).jarvisDesktop = {
      ...((window as any).jarvisDesktop || {}),
      chatApi: async (request: { operation: string }) => {
        if (request.operation === 'list') return { ok: true, status: 200, data: [chat] };
        if (request.operation === 'messages') return { ok: true, status: 200, data: [message] };
        return { ok: false, status: 400, error: 'UNSUPPORTED' };
      },
    };
  });

  await page.goto('/');
  await expect(page.locator('.chat-header h1')).toBeVisible();
  await expect(page.locator('.chat-messages .message--user').first()).toContainText('Test wyglądu');
  await expect(page.locator('.chat-history__header .chat-history__new')).toBeVisible();

  const metrics = await page.evaluate(() => {
    const style = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`Missing element: ${selector}`);
      const css = getComputedStyle(element);
      return { display: css.display, radius: css.borderTopLeftRadius, position: css.position };
    };
    return {
      chat: style('.chat'),
      header: style('.chat-header'),
      message: style('.message--user'),
      composer: style('.composer'),
    };
  });
  expect(metrics.chat.display).toBe('flex');
  expect(metrics.header.display).toBe('flex');
  expect(metrics.composer.display).toBe('flex');
  expect(metrics.message.radius).not.toBe('0px');
});
