import { test, expect } from '@playwright/test';

test('19.1 web file write is disabled unless the backend explicitly enables a workspace', async ({ page }) => {
  await page.route('**/api/agent/file-changes/status', route =>
    route.fulfill({ json: { enabled: false, scope: '', notice: 'Disabled' } }));
  await page.goto('/lab');
  // AI Lab keeps code input inside a collapsed <details> section.
  // Open it as a real user would; do not bypass visibility checks.
  await page.getByTestId('agent-context').locator('summary').click();
  await expect(page.getByTestId('agent-web-path')).toBeVisible();
  await page.getByTestId('agent-web-path').fill('demo.ts');
  await page.getByTestId('agent-web-code').fill('export const a = 1;');
  await page.getByTestId('agent-web-attach').click();
  await page.getByTestId('agent-task').fill('Zmień a na 2');
  await page.route('**/api/agent/patch-preview', route => route.fulfill({ json: {
    relativePath: 'demo.ts', original: 'export const a = 1;', proposed: 'export const a = 2;',
    diff: '-export const a = 1;\n+export const a = 2;', notice: 'Read only',
    review: { originalLines: 1, proposedLines: 1, addedLines: 1, removedLines: 1, warnings: [], scope: 'one file' },
  } }));
  await page.getByTestId('agent-generate-diff').click();
  await expect(page.getByTestId('agent-file-write')).toBeVisible();
  await expect(page.getByTestId('file-write-disabled')).toBeVisible();
  await expect(page.getByTestId('file-write-prepare')).toHaveCount(0);
});

test('19.1 prepare then explicit apply; no write before confirmation', async ({ page }) => {
  let writes = 0;
  await page.route('**/api/agent/file-changes/status', route =>
    route.fulfill({ json: { enabled: true, scope: 'C:/SafeProject', notice: 'Ready' } }));
  await page.route('**/api/agent/file-changes/history', route => route.fulfill({ json: [] }));
  await page.route('**/api/agent/file-changes/prepare', route => route.fulfill({ json: {
    ticket: 'one-time', relativePath: 'demo.ts', beforeSha256: 'a'.repeat(64), afterSha256: 'b'.repeat(64),
    expiresInSeconds: 300, notice: 'Ready',
  } }));
  await page.route('**/api/agent/file-changes/apply', route => {
    writes++;
    return route.fulfill({ json: { status: 'applied', deploymentId: 'id', relativePath: 'demo.ts', message: 'Saved' } });
  });
  await page.route('**/api/agent/patch-preview', route => route.fulfill({ json: {
    relativePath: 'demo.ts', original: 'export const a = 1;', proposed: 'export const a = 2;',
    diff: '-export const a = 1;\n+export const a = 2;', notice: 'Read only',
    review: { originalLines: 1, proposedLines: 1, addedLines: 1, removedLines: 1, warnings: [], scope: 'one file' },
  } }));
  await page.goto('/lab');
  // AI Lab keeps code input inside a collapsed <details> section.
  // Open it as a real user would; do not bypass visibility checks.
  await page.getByTestId('agent-context').locator('summary').click();
  await expect(page.getByTestId('agent-web-path')).toBeVisible();
  await page.getByTestId('agent-web-path').fill('demo.ts');
  await page.getByTestId('agent-web-code').fill('export const a = 1;');
  await page.getByTestId('agent-web-attach').click();
  await page.getByTestId('agent-task').fill('Zmień a na 2');
  await page.getByTestId('agent-generate-diff').click();
  await expect(page.getByTestId('file-write-prepare')).toBeVisible();
  await expect(page.getByTestId('file-write-prepare')).toBeDisabled();
  expect(writes).toBe(0);
  await page.getByTestId('file-write-consent').check();
  await page.getByTestId('file-write-prepare').click();
  await expect(page.getByTestId('file-write-confirmation')).toBeVisible();
  expect(writes).toBe(0);
  await page.getByTestId('file-write-apply').click();
  await expect(page.getByTestId('file-write-message')).toContainText('Saved');
  expect(writes).toBe(1);
});
