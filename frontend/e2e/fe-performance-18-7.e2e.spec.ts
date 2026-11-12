import { expect, test } from '@playwright/test';

test('18.7: browser Chat scroll stays correct for a long history and a delayed HTTP response', async ({ page }) => {
  const id = '22222222-2222-4222-8222-222222222222';
  const now = '2026-11-12T18:00:00Z';
  const chat = { id, title: 'Długa rozmowa', createdAt: now, updatedAt: now };
  const history = Array.from({ length: 80 }, (_, index) => ({
    id: `44444444-4444-4444-8444-${String(index).padStart(12, '0')}`,
    conversationId: id, role: index % 2 ? 'ASSISTANT' : 'USER',
    content: `Poprzednia wiadomość ${index} ` + 'x'.repeat(120),
    createdAt: now, order: index + 1,
  }));

  await page.route('**/api/chats**', async (route) => {
    const { pathname } = new URL(route.request().url());
    const method = route.request().method();
    let body: unknown = [];
    if (pathname === '/api/chats' && method === 'GET') body = [chat];
    else if (pathname === `/api/chats/${id}/messages` && method === 'GET') body = history;
    else if (pathname === `/api/chats/${id}/messages` && method === 'POST') {
      await new Promise(resolve => setTimeout(resolve, 150));
      body = {
        userMessage: { id: 'u-81', conversationId: id, role: 'USER', content: 'Nowe pytanie', createdAt: now, order: 81 },
        assistantMessage: { id: 'a-82', conversationId: id, role: 'ASSISTANT', content: 'Odpowiedź Qwen', createdAt: now, order: 82 },
      };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });

  await page.goto('/chat');
  const pane = page.getByTestId('chat-messages');
  await expect(pane.locator('.message')).toHaveCount(80);
  const nearBottom = () => pane.evaluate((element: HTMLElement) =>
    element.scrollHeight - element.scrollTop - element.clientHeight < 5);
  await expect.poll(nearBottom).toBe(true);

  await pane.evaluate((element: HTMLElement) => { element.scrollTop = 0; });
  const input = page.getByTestId('chat-input');
  await input.fill('Nowe pytanie');
  await input.press('Enter');
  await expect(pane.getByText('Odpowiedź Qwen')).toBeVisible();
  await expect.poll(nearBottom).toBe(true);
  await expect(input).toBeFocused();
});

test('18.7: AI Lab overview and source review remain usable on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/lab');
  await expect(page.getByTestId('ai-lab-explainer')).toBeVisible();
  await expect(page.getByTestId('agent-workflow-guide')).toBeVisible();
  const viewportWidth = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(viewportWidth).toBeLessThanOrEqual(2);

  const context = page.getByTestId('agent-context');
  await context.locator('summary').click();
  await expect(page.getByTestId('agent-web-source')).toBeVisible();
  await expect(page.getByTestId('agent-web-attach')).toBeDisabled();
});
