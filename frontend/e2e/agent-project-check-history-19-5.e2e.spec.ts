import { expect, test } from '@playwright/test';

test('19.5: history displays server records and compares runs without triggering writes', async ({ page }) => {
  let queries = 0;
  let writes = 0;
  await page.route('**/api/agent/isolated-checks/status', route =>
    route.fulfill({ json: { enabled: false, notice: 'Disabled for this test' } }));
  await page.route('**/api/agent/file-changes/status', route =>
    route.fulfill({ json: { enabled: false, scope: '', notice: 'Disabled' } }));
  await page.route('**/api/agent/patch-preview', route => route.fulfill({ json: {
    relativePath: 'frontend/src/app/demo.ts', original: 'export const n = 1;',
    proposed: 'export const n = 2;', diff: '-1\n+2', notice: 'Read only',
    review: { originalLines: 1, proposedLines: 1, addedLines: 1, removedLines: 1, warnings: [], scope: 'one file' },
  } }));
  await page.route('**/api/agent/project-checks/history?*', route => {
    queries++;
    return route.fulfill({ json: [
      { checkId: 'first', kind: 'angular', status: 'passed', relativePath: 'src/app/demo.ts',
        proposedSha256: 'a'.repeat(64), snapshotSha256: 'c'.repeat(64), image: 'test-image',
        fileCount: 5, elapsedMs: 100, createdAt: '2026-11-13T10:00:00Z' },
      { checkId: 'second', kind: 'angular', status: 'failed', relativePath: 'src/app/demo.ts',
        proposedSha256: 'b'.repeat(64), snapshotSha256: 'd'.repeat(64), image: 'test-image',
        fileCount: 5, elapsedMs: 125, createdAt: '2026-11-13T10:01:00Z' },
    ] });
  });
  await page.route('**/api/agent/file-changes/apply', route => {
    writes++;
    return route.fulfill({ json: {} });
  });
  await page.goto('/lab');
  await page.getByTestId('agent-context').locator('summary').click();
  await page.getByTestId('agent-web-path').fill('frontend/src/app/demo.ts');
  await page.getByTestId('agent-web-code').fill('export const n = 1;');
  await page.getByTestId('agent-web-attach').click();
  await page.getByTestId('agent-task').fill('Change n to 2');
  await page.getByTestId('agent-generate-diff').click();
  await page.getByTestId('agent-project-check').locator('summary').click();
  await expect(page.getByTestId('project-check-history')).toBeVisible();
  expect(queries).toBe(0);
  await page.getByTestId('project-history-refresh').click();
  await expect(page.getByTestId('project-history-count')).toContainText('2');
  await expect(page.getByTestId('project-history-comparison')).toBeVisible();
  expect(queries).toBe(1);
  expect(writes).toBe(0);
});
