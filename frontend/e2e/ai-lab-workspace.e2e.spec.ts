import { expect, test } from '@playwright/test';

test('AI Lab workspace is read-only and shows approved files', async ({ page }) => {
  await page.addInitScript(() => {
    let selected: string | null = null;
    (window as unknown as { jarvisDesktop: unknown }).jarvisDesktop = {
      workspaceApi: async (req: { operation: string; relativePath?: string }) => {
        if (req.operation === 'choose') selected = 'C:/projects/demo';
        if (req.operation === 'clear') selected = null;
        if (req.operation === 'status' || req.operation === 'choose' || req.operation === 'clear') {
          return { ok: true, data: { selected, readOnly: true, writeEnabled: false } };
        }
        if (req.operation === 'list') return { ok: true, data: { relativePath: req.relativePath || '', entries: [ { name: 'demo.ts', kind: 'file', relativePath: 'demo.ts' } ] } };
        if (req.operation === 'read') return { ok: true, data: { relativePath: 'demo.ts', size: 9, content: 'const x=1' } };
        return { ok: false, error: 'UNSUPPORTED' };
      },
    };
  });
  await page.goto('/');
  const select = page.locator('select').first();
  await expect(select).toBeVisible();
  const options = await select.locator('option').allTextContents();
  const option = options.find(v => /ai lab/i.test(v));
  expect(option).toBeTruthy();
  await select.selectOption({ label: option! });
  await expect(page.getByTestId('ai-lab-workspace')).toBeAttached();
  const workspace = page.getByTestId('ai-lab-workspace');
  await workspace.getByTestId('workspace-choose').click();
  await expect(workspace.getByTestId('workspace-path')).toContainText('demo');
  await workspace.getByText('demo.ts').click();
  await expect(workspace.getByTestId('workspace-preview')).toContainText('const x=1');
  await workspace.getByTestId('workspace-clear').click();
  await expect(workspace.getByTestId('workspace-path')).not.toContainText('C:/projects/demo');
});
