import { expect, test } from '@playwright/test';

test('AI Lab: renders Markdown and requires confirmation before deleting a saved proposal', async ({ page }) => {
  const id = '8ef71522-27d0-4f9b-9bb3-d0245b9bf440';
  let rows = [{
    id,
    task: 'Popraw Promise',
    plan: '## Cel\n**Zmiana**\n\n- Testy',
    status: 'APPROVED',
    createdAt: '2026-11-15T12:00:00Z',
    updatedAt: '2026-11-15T12:00:00Z',
  }];
  let deleteCount = 0;

  // Mock HTTP transport used by the web build, not Electron-only bridge.
  await page.route('**/api/agent/proposals', async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
  });
  await page.route('**/api/agent/proposals/*', async (route) => {
    if (route.request().method() !== 'DELETE') return route.continue();
    deleteCount++;
    rows = rows.filter(row => !route.request().url().endsWith('/' + row.id));
    await route.fulfill({ status: 204, body: '' });
  });

  await page.goto('/lab');
  const agent = page.getByTestId('ai-lab-agent-section');
  await expect(agent).toBeVisible();
  if (!(await agent.evaluate(el => (el as HTMLDetailsElement).open))) {
    await agent.locator(':scope > summary').click();
  }
  const panel = page.getByTestId('agent-planner');
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId('agent-plan').locator('h2')).toHaveText('Cel');
  await expect(panel.getByTestId('agent-plan').locator('strong')).toHaveText('Zmiana');

  await panel.getByTestId('agent-delete').click();
  await expect(panel.getByTestId('agent-delete-dialog')).toBeVisible();
  await panel.getByTestId('agent-delete-cancel').click();
  await expect(panel.getByTestId('agent-proposals').locator('.agent-planner__history-item')).toHaveCount(1);
  expect(deleteCount, 'Cancel must not invoke DELETE').toBe(0);

  await panel.getByTestId('agent-delete').click();
  await panel.getByTestId('agent-delete-confirm').click();
  await expect(panel.getByTestId('agent-proposals')).toHaveCount(0);
  expect(deleteCount, 'Confirm must invoke exactly one DELETE').toBe(1);
});
