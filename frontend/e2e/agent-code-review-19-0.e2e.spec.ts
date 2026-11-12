import { expect, test } from '@playwright/test';

test('19.0: an approved excerpt produces a reviewed read-only diff; no file writes', async ({ page }) => {
  const calls: { url: string; method: string }[] = [];
  await page.route('**/api/agent/proposals', route => route.fulfill({
    status: 200, contentType: 'application/json', body: '[]',
  }));
  await page.route('**/api/agent/patch-preview', async route => {
    const body = route.request().postDataJSON();
    calls.push({ url: route.request().url(), method: route.request().method() });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      relativePath: body.source.relativePath,
      original: body.source.content,
      proposed: 'eval("bad()");\nexport const x = 2;',
      diff: '-export const x = 1;\n+eval("bad()");\n+export const x = 2;',
      notice: 'No disk writes',
      review: { beforeLines: 1, afterLines: 2, removedLines: 1, addedLines: 2, warnings: ['DYNAMIC_CODE'] },
    }) });
  });
  await page.goto('/lab');
  const planner = page.getByTestId('agent-planner');
  const sourcePanel = planner.getByTestId('agent-context');
  await sourcePanel.locator('summary').click();
  await sourcePanel.getByTestId('agent-web-path').fill('frontend/src/app/demo.ts');
  await sourcePanel.getByTestId('agent-web-code').fill('export const x = 1;');
  await expect(planner.getByTestId('agent-change-review')).toHaveCount(0);
  expect(calls).toHaveLength(0);
  await sourcePanel.getByTestId('agent-web-attach').click();
  await planner.getByTestId('agent-task').fill('Make the value 2');
  await planner.getByTestId('agent-generate-diff').click();
  await expect(planner.getByTestId('agent-review-metrics')).toContainText('2');
  await expect(planner.getByTestId('agent-review-risks')).toContainText('dynamiczne');
  await expect(planner.getByTestId('agent-review-no-tests')).toContainText('nie został skompilowany');
  await expect(planner.getByTestId('agent-diff-proposed')).toContainText('export const x = 2;');
  await expect(planner.getByTestId('agent-approve')).toHaveCount(0);
  expect(calls).toHaveLength(1);
  expect(calls[0].method).toBe('POST');
});

test('19.0: refuses a preview for another source and preserves entered task', async ({ page }) => {
  await page.route('**/api/agent/proposals', route => route.fulfill({
    status: 200, contentType: 'application/json', body: '[]',
  }));
  await page.route('**/api/agent/patch-preview', async route => {
    const body = route.request().postDataJSON();
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      relativePath: body.source.relativePath, original: 'not the approved text',
      proposed: 'const malicious = 1;', diff: '-a\n+b', notice: 'Untrusted',
    }) });
  });
  await page.goto('/lab');
  const planner = page.getByTestId('agent-planner');
  const sourcePanel = planner.getByTestId('agent-context');
  await sourcePanel.locator('summary').click();
  await sourcePanel.getByTestId('agent-web-path').fill('frontend/src/app/demo.ts');
  await sourcePanel.getByTestId('agent-web-code').fill('export const x = 1;');
  await sourcePanel.getByTestId('agent-web-attach').click();
  await planner.getByTestId('agent-task').fill('Make the value 2');
  await planner.getByTestId('agent-generate-diff').click();
  await expect(planner.getByTestId('agent-diff-error')).toContainText('Niezgodny');
  await expect(planner.getByTestId('agent-change-review')).toHaveCount(0);
  await expect(planner.getByTestId('agent-task')).toHaveValue('Make the value 2');
});
