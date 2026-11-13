import { expect, test } from '@playwright/test';

test('19.3 checks explicitly selected sibling files, displays hashes and never writes automatically', async ({ page }) => {
  let runs = 0;
  let writes = 0;
  await page.route('**/api/agent/file-changes/status', route =>
    route.fulfill({ json: { enabled: false, scope: '', notice: 'Disabled' } }));
  await page.route('**/api/agent/isolated-checks/status', route =>
    route.fulfill({ json: { enabled: true, notice: 'Ready' } }));
  await page.route('**/api/agent/module-checks/run', async route => {
    runs++;
    const request = route.request().postDataJSON();
    expect(request.relativePath).toBe('counter.js');
    expect(request.proposed).toBe('module.exports = 2;');
    expect(request.relatedFiles).toEqual([{ name: 'counter.test.cjs', content: "const assert = require('node:assert'); assert.equal(require('./counter.js'), 2);" }]);
    expect(request.testFile).toBe('counter.test.cjs');
    await route.fulfill({ json: {
      checkId: 'fake', relativePath: 'counter.js', kind: 'JS_TEST_MODULE', status: 'passed',
      proposedSha256: 'a'.repeat(64), snapshotSha256: 'b'.repeat(64),
      summary: 'One selected test passed', fileCount: 2, output: '1 passed', elapsedMs: 25,
    } });
  });
  await page.route('**/api/agent/file-changes/apply', route => {
    writes++;
    return route.fulfill({ json: {} });
  });
  await page.route('**/api/agent/patch-preview', route => route.fulfill({ json: {
    relativePath: 'counter.js', original: 'module.exports = 1;', proposed: 'module.exports = 2;',
    diff: '-module.exports = 1;\n+module.exports = 2;', notice: 'Read only',
    review: { originalLines: 1, proposedLines: 1, addedLines: 1, removedLines: 1, warnings: [], scope: 'one file' },
  } }));

  await page.goto('/lab');
  await page.getByTestId('agent-context').locator('summary').click();
  await page.getByTestId('agent-web-path').fill('counter.js');
  await page.getByTestId('agent-web-code').fill('module.exports = 1;');
  await page.getByTestId('agent-web-attach').click();
  await page.getByTestId('agent-task').fill('Change n to 2');
  await page.getByTestId('agent-generate-diff').click();
  await expect(page.getByTestId('agent-module-check')).toBeVisible();
  await page.getByTestId('agent-module-check').locator('summary').click();
  await expect(page.getByTestId('module-run')).toBeVisible();
  expect(runs).toBe(0);
  await page.getByTestId('module-files').setInputFiles({
    name: 'counter.test.cjs', mimeType: 'text/plain',
    buffer: Buffer.from("const assert = require('node:assert'); assert.equal(require('./counter.js'), 2);"),
  });
  await expect(page.getByTestId('module-file-count')).toContainText('2');
  await page.getByTestId('module-run').click();
  await expect(page.getByTestId('module-result')).toContainText('One selected test passed');
  expect(runs).toBe(1);
  expect(writes).toBe(0);
  await expect(page.getByTestId('file-write-disabled')).toBeVisible();
});
