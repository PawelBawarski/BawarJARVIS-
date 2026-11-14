import { expect, test, type Locator } from '@playwright/test';

async function revealWorkspaceChooser(context: Locator): Promise<void> {
  await context.evaluate(element => {
    (element as HTMLDetailsElement).open = true;
  });

  const choose = context.getByTestId('agent-workspace-choose');
  await expect(choose).toBeAttached();

  await choose.evaluate(element => {
    let node: Element | null = element;
    while (node) {
      if (node instanceof HTMLDetailsElement) node.open = true;
      node = node.parentElement;
    }
  });

  await expect(choose).toBeVisible();
}


test('approved snippet produces read-only code diff; no apply operation exists', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__patchCalls = [];
    (window as any).jarvisDesktop = {
      ...((window as any).jarvisDesktop ?? {}),
      workspaceApi: async (request: any) => {
        (window as any).__patchCalls.push({ channel: 'workspace', request });
        if (request.operation === 'choose' || request.operation === 'status')
          return { ok: true, data: { selected: 'C:/DemoProject', readOnly: true, writeEnabled: false } };
        if (request.operation === 'list') return { ok: true, data: { relativePath: request.relativePath, entries: [
          { kind: 'file', name: 'sample.ts', relativePath: 'frontend/src/app/sample.ts' },
        ] } };
        if (request.operation === 'read') return { ok: true, data: {
          relativePath: 'frontend/src/app/sample.ts', content: 'export const x = 1;', size: 19,
        } };
        return { ok: false, error: 'NOT_ALLOWED' };
      },
      agentProposalApi: async (request: any) => {
        (window as any).__patchCalls.push({ channel: 'agent', request });
        if (request.operation === 'list') return { ok: true, status: 200, data: [] };
        if (request.operation === 'patch-preview') return { ok: true, status: 200, data: {
          relativePath: request.source.relativePath, original: request.source.content,
          proposed: 'export const x = 2;',
          diff: '--- a/sample.ts\n+++ b/sample.ts\n-export const x = 1;\n+export const x = 2;',
          notice: 'Nie zapisano żadnej zmiany.',
        } };
        return { ok: false, status: 400, error: 'UNSUPPORTED' };
      },
    };
  });
  await page.goto('/lab');
  const panel = page.getByTestId('agent-planner');
  await expect(panel).toBeVisible();
  const context = panel.getByTestId('agent-context');
  await revealWorkspaceChooser(context);
  await context.getByTestId('agent-workspace-choose').click();
  await context.getByRole('button', { name: 'sample.ts' }).click();
  await context.getByTestId('agent-attach-source').click();
  await panel.getByTestId('agent-task').fill('Zmień stałą x na 2');
  await panel.getByTestId('agent-generate-diff').click();
  await expect(panel.getByTestId('agent-diff-result')).toBeVisible();
  await expect(panel.getByTestId('agent-diff-original')).toContainText('x = 1');
  await expect(panel.getByTestId('agent-diff-proposed')).toContainText('x = 2');
  await expect(panel.getByTestId('agent-diff-text')).toContainText('+export const x = 2;');
  const calls = await page.evaluate(() => (window as any).__patchCalls as Array<{ channel: string; request: any }>);
  expect(calls.filter(call => call.channel === 'agent' && call.request.operation === 'patch-preview'))
    .toEqual([{ channel: 'agent', request: { operation: 'patch-preview', task: 'Zmień stałą x na 2',
      source: { relativePath: 'frontend/src/app/sample.ts', content: 'export const x = 1;' } } }]);
  expect(calls.every(call => !['write', 'apply', 'delete', 'execute'].includes(call.request.operation))).toBe(true);
});
