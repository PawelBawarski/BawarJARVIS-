import { expect, test } from '@playwright/test';

// E2E exercises the real Angular integration. Docker is mocked to avoid running untrusted code in CI.
test('19.2 requires a click, reports the check and never modifies a file', async ({ page }) => {
  let checks = 0;
  let applies = 0;
  await page.route('**/api/agent/file-changes/status', route => route.fulfill({ json: { enabled: false, scope: '', notice: 'Disabled' } }));
  await page.route('**/api/agent/isolated-checks/status', route => route.fulfill({ json: { enabled: true, notice: 'Enabled' } }));
  await page.route('**/api/agent/isolated-checks/run', route => {
    checks++;
    return route.fulfill({ json: { checkId: 'ok', relativePath: 'demo.ts', proposedSha256: 'a'.repeat(64),
      kind: 'TS_SYNTAX', status: 'passed', summary: 'Parser passed', output: 'No errors', elapsedMs: 20 } });
  });
  await page.route('**/api/agent/file-changes/apply', route => { applies++; return route.fulfill({ json: {} }); });
  await page.route('**/api/agent/patch-preview', route => route.fulfill({ json: {
    relativePath: 'demo.ts', original: 'export const a = 1;', proposed: 'export const a = 2;',
    diff: '-export const a = 1;\n+export const a = 2;', notice: 'Read only',
    review: { originalLines: 1, proposedLines: 1, addedLines: 1, removedLines: 1, warnings: [], scope: 'one file' },
  } }));

  await page.goto('/lab');
  await page.getByTestId('agent-context').locator('summary').click();
  await page.getByTestId('agent-web-path').fill('demo.ts');
  await page.getByTestId('agent-web-code').fill('export const a = 1;');
  await page.getByTestId('agent-web-attach').click();
  await page.getByTestId('agent-task').fill('Zmień a na 2');
  await page.getByTestId('agent-generate-diff').click();
  await expect(page.getByTestId('agent-isolated-check')).toBeVisible();
  await expect(page.getByTestId('isolated-run')).toBeVisible();
  expect(checks).toBe(0);
  await page.getByTestId('isolated-run').click();
  await expect(page.getByTestId('isolated-result')).toContainText('Parser passed');
  expect(checks).toBe(1);
  expect(applies).toBe(0);
  await expect(page.getByTestId('file-write-disabled')).toBeVisible();
});

test('19.2 remains off when the server has not enabled Docker checks', async ({ page }) => {
  await page.route('**/api/agent/file-changes/status', route => route.fulfill({ json: { enabled: false, scope: '', notice: 'Disabled' } }));
  await page.route('**/api/agent/isolated-checks/status', route => route.fulfill({ json: { enabled: false, notice: 'Disabled' } }));
  await page.route('**/api/agent/patch-preview', route => route.fulfill({ json: {
    relativePath: 'demo.js', original: 'const a = 1;', proposed: 'const a = 2;', diff: '-1\n+2', notice: 'Read only',
    review: { originalLines: 1, proposedLines: 1, addedLines: 1, removedLines: 1, warnings: [], scope: 'one file' },
  } }));
  await page.goto('/lab');
  await page.getByTestId('agent-context').locator('summary').click();
  await page.getByTestId('agent-web-path').fill('demo.js');
  await page.getByTestId('agent-web-code').fill('const a = 1;');
  await page.getByTestId('agent-web-attach').click();
  await page.getByTestId('agent-task').fill('Zmień a na 2');
  await page.getByTestId('agent-generate-diff').click();
  await expect(page.getByTestId('isolated-disabled')).toBeVisible();
  await expect(page.getByTestId('isolated-run')).toHaveCount(0);
});
