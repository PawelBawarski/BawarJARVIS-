import { test, expect } from '@playwright/test';

test('20.2: explicit document import, list and two-step delete', async ({ page }) => {
  const document = { id: 'a0000000-0000-4000-a000-000000000001', fileName: 'notes.md', kind: 'md', byteSize: 32, chunkCount: 1, createdAt: '2026-11-13T12:00:00Z' };
  let uploads = 0;
  let deletes = 0;
  await page.route('**/api/research/documents', route => {
    if (route.request().method() === 'POST') {
      uploads++;
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(document) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
  await page.route('**/api/research/documents/*', route => {
    deletes++;
    return route.fulfill({ status: 204 });
  });

  await page.goto('/lab');
  const panel = page.getByTestId('memory-document-import');
  await expect(panel).toBeVisible();
  await panel.getByTestId('memory-documents-file').setInputFiles({
    name: 'notes.md', mimeType: 'text/markdown', buffer: Buffer.from('# Angular\nSignals track state'),
  });
  expect(uploads).toBe(0);
  await panel.getByTestId('memory-documents-import').click();
  await expect(panel.getByTestId('memory-documents-list')).toContainText('notes.md');
  expect(uploads).toBe(1);
  await panel.getByTestId('memory-documents-request-delete').click();
  expect(deletes).toBe(0);
  await panel.getByTestId('memory-documents-confirm-delete').click();
  await expect(panel.getByTestId('memory-documents-list')).not.toContainText('notes.md');
  expect(deletes).toBe(1);
});
