import { expect, test } from '@playwright/test';

test('18.9: backend status reports real local health and offers a manual retry', async ({ page }) => {
  let healthy = false;
  await page.route('**/api/security/health', async route => route.fulfill({
    status: healthy ? 200 : 503,
    contentType: 'application/json',
    body: JSON.stringify({ status: healthy ? 'UP' : 'DOWN' }),
  }));
  await page.goto('/chat');
  const status = page.getByTestId('backend-connection');
  await expect(status).toHaveAttribute('aria-label', 'Backend niedostępny');
  healthy = true;
  await status.click();
  await expect(status).toHaveAttribute('aria-label', 'Backend dostępny');
});

test('18.9: failed POST is not replayed and Chat keeps unsent draft on backend loss', async ({ page }) => {
  let sends = 0;
  await page.route('**/api/security/health', route => route.fulfill({
    status: 200, contentType: 'application/json', body: '{"status":"UP"}',
  }));
  await page.route('**/api/chats', async route => route.fulfill({
    status: route.request().method() === 'GET' ? 200 : 201,
    contentType: 'application/json',
    body: route.request().method() === 'GET' ? '[]' : JSON.stringify({
      id: 'dbbaa763-372b-48fa-bdf5-674d76a11d30',
      title: 'Nowa rozmowa', createdAt: '2026-11-12T10:00:00Z',
      updatedAt: '2026-11-12T10:00:00Z',
    }),
  }));
  await page.route('**/api/chats/model-status', async route => route.fulfill({
    status: 200, contentType: 'application/json', body: '{"model":"jarvis-qwen3-8b","ready":true}',
  }));
  await page.route('**/api/chats/*/messages', async route => {
    if (route.request().method() !== 'POST') return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    sends++;
    return route.abort('failed');
  });
  await page.goto('/chat');
  const draft = page.getByTestId('chat-input');
  await draft.fill('This message must not be submitted twice');
  await page.getByTestId('chat-send').click();

  // Wait for the failed POST to finish. Checking the unchanged input alone is
  // insufficient: the assertion can pass before the async request is sent.
  await expect(page.getByRole('alert')).toContainText(
    'Nie otrzymano potwierdzenia wysłania',
  );
  await expect(draft).toHaveValue('This message must not be submitted twice');
  expect(sends).toBe(1);
});


test('18.9: AI Lab retains a task and code after a lost plan-generation response', async ({ page }) => {
  let sends = 0;
  await page.route('**/api/security/health', route => route.fulfill({
    status: 200, contentType: 'application/json', body: '{"status":"UP"}',
  }));
  await page.route('**/api/agent/proposals', async route => {
    if (route.request().method() === 'GET') return route.fulfill({
      status: 200, contentType: 'application/json', body: '[]',
    });
    sends++;
    return route.abort('failed');
  });
  await page.goto('/lab');
  const planner = page.getByTestId('agent-planner');
  await planner.getByTestId('agent-context').locator('summary').click();
  await planner.getByTestId('agent-web-path').fill('frontend/src/app/demo.ts');
  await planner.getByTestId('agent-web-code').fill('export const ready = true;');
  await planner.getByTestId('agent-web-attach').click();
  await planner.getByTestId('agent-task').fill('Review this Angular code');
  await planner.getByTestId('agent-generate').click();
  await expect(planner.getByTestId('agent-task')).toHaveValue('Review this Angular code');
  await expect(planner.getByTestId('agent-selected-sources')).toContainText('frontend/src/app/demo.ts');
  await expect(planner.getByRole('alert')).toContainText('Nie otrzymano potwierdzenia operacji');
  expect(sends).toBe(1);
});
