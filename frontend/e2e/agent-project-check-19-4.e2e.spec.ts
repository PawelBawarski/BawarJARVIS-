import { expect, test } from '@playwright/test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('19.4 requires explicit project selection and click; does not write files', async ({ page }) => {
  let checks = 0;
  let writes = 0;
  const folder = mkdtempSync(join(tmpdir(), 'jarvis-194-'));
  try {
    mkdirSync(join(folder, 'src', 'app'), { recursive: true });
    for (const name of ['package.json', 'package-lock.json', 'angular.json', 'tsconfig.json'])
      writeFileSync(join(folder, name), '{}');
    writeFileSync(join(folder, 'src', 'app', 'demo.ts'), 'export const n = 1;');
    await page.route('**/api/agent/isolated-checks/status', route =>
      route.fulfill({ json: { enabled: true, notice: 'Ready' } }));
    await page.route('**/api/agent/file-changes/status', route =>
      route.fulfill({ json: { enabled: false, scope: '', notice: 'Disabled' } }));
    await page.route('**/api/agent/patch-preview', route => route.fulfill({ json: {
      relativePath: 'frontend/src/app/demo.ts', original: 'export const n = 1;',
      proposed: 'export const n = 2;', diff: '-1\n+2', notice: 'Read only',
      review: { originalLines: 1, proposedLines: 1, addedLines: 1, removedLines: 1, warnings: [], scope: 'one file' },
    } }));
    await page.route('**/api/agent/project-checks/run', route => {
      checks++;
      const body = route.request().postDataJSON();
      expect(body.projectKind).toBe('angular');
      expect(body.files).toContainEqual({ path: 'src/app/demo.ts', content: 'export const n = 1;' });
      return route.fulfill({ json: {
        checkId: 'example', kind: 'angular', status: 'passed', summary: 'Mock tests passed',
        relativePath: 'src/app/demo.ts', proposedSha256: 'a'.repeat(64), snapshotSha256: 'b'.repeat(64),
        image: 'jarvis-angular-test:19-4-123456789abc', fileCount: 5, output: '4 passed', elapsedMs: 30,
      } });
    });
    await page.route('**/api/agent/file-changes/apply', route => {
      writes++; return route.fulfill({ json: {} });
    });
    await page.goto('/lab');
    await page.getByTestId('agent-context').locator('summary').click();
    await page.getByTestId('agent-web-path').fill('frontend/src/app/demo.ts');
    await page.getByTestId('agent-web-code').fill('export const n = 1;');
    await page.getByTestId('agent-web-attach').click();
    await page.getByTestId('agent-task').fill('Change n to 2');
    await page.getByTestId('agent-generate-diff').click();
    await page.getByTestId('agent-project-check').locator('summary').click();
    await expect(page.getByTestId('project-run')).toBeDisabled();
    expect(checks).toBe(0);
    await page.getByTestId('project-directory').setInputFiles(folder);
    await expect(page.getByTestId('project-count')).toContainText('5');
    await expect(page.getByTestId('project-run')).toBeEnabled();
    await page.getByTestId('project-run').click();
    await expect(page.getByTestId('project-result')).toContainText('Mock tests passed');
    expect(checks).toBe(1);
    expect(writes).toBe(0);
  } finally { rmSync(folder, { recursive: true, force: true }); }
});
