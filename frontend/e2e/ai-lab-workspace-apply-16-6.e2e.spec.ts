import { expect, test } from '@playwright/test';

test('a reviewed patch is applied only after native test grant and explicit user consent', async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as any).__applyCalls = [];
    (window as any).jarvisDesktop = {
      ...((window as any).jarvisDesktop ?? {}),
      workspaceApi: async (req: any) => {
        if (req.operation === 'choose' || req.operation === 'status') {
          return {
            ok: true,
            data: { selected: 'C:/DemoProject', readOnly: true, writeEnabled: false },
          };
        }
        if (req.operation === 'list')
          return {
            ok: true,
            data: {
              relativePath: '',
              entries: [
                { kind: 'file', name: 'sample.ts', relativePath: 'frontend/src/app/sample.ts' },
              ],
            },
          };
        if (req.operation === 'read')
          return {
            ok: true,
            data: {
              relativePath: 'frontend/src/app/sample.ts',
              content: 'export const x = 1;',
              size: 19,
            },
          };
        return { ok: false, error: 'DENIED' };
      },
      agentProposalApi: async (req: any) => {
        if (req.operation === 'list') return { ok: true, status: 200, data: [] };
        if (req.operation === 'patch-preview')
          return {
            ok: true,
            status: 200,
            data: {
              relativePath: req.source.relativePath,
              original: req.source.content,
              proposed: 'export const x = 2;',
              diff: '-export const x = 1;\n+export const x = 2;',
              notice: 'Bez zapisu',
            },
          };
        return { ok: false, status: 400, error: 'UNSUPPORTED' };
      },
      agentProjectTest: async (_req: any) => ({
        status: 'passed',
        scope: 'frontend',
        message: 'Build + Vitest OK',
        grantId: 'a'.repeat(48),
      }),
      agentWorkspaceApply: async (req: any) => {
        if (req.operation === 'history') return { status: 'ok', deployments: [] };
        (window as any).__applyCalls.push(req);
        if (req.operation === 'apply')
          return {
            status: 'applied',
            relativePath: 'frontend/src/app/sample.ts',
            deploymentId: 'b'.repeat(48),
            message: 'Wdrożono',
          };
        if (req.operation === 'rollback')
          return {
            status: 'rolled_back',
            relativePath: 'frontend/src/app/sample.ts',
            message: 'Przywrócono',
          };
      },
    };
  });
  await page.goto('/');
  const panel = page.getByTestId('agent-planner');
  const switcher = page.locator('app-module-switcher');
  const select = switcher.locator('select').first();
  if (await select.count()) {
    const option = await select.locator('option').evaluateAll(
      (options) =>
        options
          .map((o) => ({
            value: (o as HTMLOptionElement).value,
            label: o.textContent?.trim() ?? '',
          }))
          .find((o) => o.value === 'lab' || /AI Lab/i.test(o.label)) ?? null,
    );
    if (!option) throw new Error('AI Lab not found');
    await select.selectOption(option.value);
  } else {
    const next = switcher.getByRole('button').last();
    for (let i = 0; i < 12 && !(await panel.isVisible()); i++) await next.click();
  }
  await expect(panel).toBeVisible();
  const context = panel.getByTestId('agent-context');
  await context.evaluate((node: HTMLDetailsElement) => {
    node.open = true;
  });
  await context.getByTestId('agent-workspace-choose').click();
  await context.getByRole('button', { name: 'sample.ts' }).click();
  await context.getByTestId('agent-attach-source').click();
  await panel.getByTestId('agent-task').fill('Zmień x na 2');
  await panel.getByTestId('agent-generate-diff').click();
  await expect(panel.getByTestId('agent-diff-result')).toBeVisible();
  const testPanel = panel.getByTestId('agent-project-test');
  const deploy = panel.getByTestId('agent-workspace-apply');
  const apply = deploy.getByTestId('agent-apply-run');
  await expect(apply).toBeDisabled();
  expect(await page.evaluate(() => (window as any).__applyCalls)).toHaveLength(0);
  await testPanel.getByTestId('agent-project-test-consent').check();
  await testPanel.getByTestId('agent-project-test-run').click();
  await expect(testPanel.getByTestId('agent-project-test-report')).toContainText('Testy zaliczone');
  await expect(apply).toBeDisabled();
  await deploy.getByTestId('agent-apply-consent').check();
  await expect(apply).toBeEnabled();
  await apply.click();
  await expect(deploy.getByTestId('agent-apply-message')).toContainText('Wdrożono');
  expect(await page.evaluate(() => (window as any).__applyCalls)).toEqual([
    { operation: 'apply', grantId: 'a'.repeat(48) },
  ]);
  await deploy.getByTestId('agent-apply-rollback').click();
  await expect(deploy.getByTestId('agent-apply-message')).toContainText('Przywrócono');
  expect(await page.evaluate(() => (window as any).__applyCalls)).toEqual([
    { operation: 'apply', grantId: 'a'.repeat(48) },
    { operation: 'rollback', deploymentId: 'b'.repeat(48) },
  ]);
});
