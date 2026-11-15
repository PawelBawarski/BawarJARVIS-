import { expect, test } from '@playwright/test';

test('AI Lab: controls look consistent and history delete is inside its own card', async ({ page }) => {
  const id = '95b779ca-441f-4dd9-8219-123456789abc';
  await page.route('**/api/agent/proposals', async route => {
    if (route.request().method() !== 'GET') return route.continue();
    await route.fulfill({ json: [{ id, task: 'Sprawdź formularz i historię', plan: '## Test', status: 'APPROVED', createdAt: '2026-11-15T12:00:00Z', updatedAt: '2026-11-15T12:00:00Z' }] });
  });
  await page.goto('/lab');
  const knowledge = page.getByTestId('ai-lab-research-section');
  await knowledge.locator(':scope > summary').click();
  const textArea = page.getByTestId('memory-note-content');
  await expect(textArea).toBeVisible();
  const bg = await textArea.evaluate(el => getComputedStyle(el).backgroundColor);
  expect(bg).not.toBe('rgba(0, 0, 0, 0)');
  const file = page.getByTestId('memory-documents-file');
  await expect(file).toBeVisible();
  await expect(file).toHaveCSS('border-top-style', 'solid');
  const agent = page.getByTestId('ai-lab-agent-section');
  await agent.locator(':scope > summary').click();
  const card = page.locator('.agent-planner__history-item').first();
  await expect(card).toBeVisible();
  const select = card.locator('.agent-planner__history-select');
  const remove = card.getByTestId('agent-delete');
  const [a, b] = await Promise.all([select.boundingBox(), remove.boundingBox()]);
  expect(a).not.toBeNull(); expect(b).not.toBeNull();
  expect(b!.x).toBeGreaterThanOrEqual(a!.x);
  expect(b!.x + b!.width).toBeLessThanOrEqual(a!.x + a!.width + 1);
  expect(b!.y).toBeGreaterThanOrEqual(a!.y);
  expect(b!.y + b!.height).toBeLessThanOrEqual(a!.y + a!.height + 1);
  await remove.click();
  await expect(page.getByTestId('agent-delete-dialog')).toBeVisible();
  await page.getByTestId('agent-delete-cancel').click();
  await expect(card).toBeVisible();
});
