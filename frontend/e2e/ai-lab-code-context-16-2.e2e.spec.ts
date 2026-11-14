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


test('only user-reviewed local code reaches the Qwen planning request', async ({ page }) => {
  await page.addInitScript(() => {
    const state = { selected: 'C:/DemoProject', readOnly: true, writeEnabled: false };
    (window as any).__agentRequest = null;
    (window as any).jarvisDesktop = {
      ...((window as any).jarvisDesktop ?? {}),
      workspaceApi: async (req: any) => {
        if (req.operation === 'status' || req.operation === 'choose')
          return { ok: true, data: state };
        if (req.operation === 'list') return { ok: true, data: { relativePath: req.relativePath, entries: [
          { kind: 'file', name: 'README.md', relativePath: 'README.md' },
        ] } };
        if (req.operation === 'read') return { ok: true, data: {
          relativePath: 'README.md', content: '## Architektura projektu\nAngular + Java', size: 36,
        } };
        return { ok: false, error: 'NOT_ALLOWED' };
      },
      agentProposalApi: async (request: any) => {
        if (request.operation === 'list') return { ok: true, status: 200, data: [] };
        if (request.operation === 'generate') {
          (window as any).__agentRequest = request;
          return { ok: true, status: 201, data: {
            id: '8ef71522-27d0-4f9b-9bb3-d0245b9bf440',
            task: request.task, plan: 'Plan na podstawie README.md', status: 'PENDING',
            createdAt: '2026-11-10T10:00:00Z', updatedAt: '2026-11-10T10:00:00Z',
          } };
        }
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
  await context.getByRole('button', { name: 'README.md' }).click();
  await expect(context.getByTestId('agent-workspace-preview')).toContainText('Architektura projektu');
  await expect(context.getByTestId('agent-selected-sources')).toHaveCount(0);
  await context.getByTestId('agent-attach-source').click();
  await expect(context.getByTestId('agent-selected-sources')).toContainText('README.md');
  await panel.getByTestId('agent-task').fill('Zaproponuj ulepszenie architektury');
  await panel.getByTestId('agent-generate').click();
  await expect(panel.getByTestId('agent-plan')).toContainText('README.md');
  expect(await page.evaluate(() => (window as any).__agentRequest.sources)).toEqual([
    { relativePath: 'README.md', content: '## Architektura projektu\nAngular + Java' },
  ]);
  await expect(panel.getByTestId('agent-status')).toHaveText('Do oceny');
});
