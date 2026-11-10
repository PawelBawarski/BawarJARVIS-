import { expect, test } from '@playwright/test';

test('a project copy is tested only after consent; no source write is exposed', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__projectTestCalls = [];
    (window as any).jarvisDesktop = {
      ...((window as any).jarvisDesktop ?? {}),
      workspaceApi: async (req: any) => {
        if (req.operation === 'choose' || req.operation === 'status') {
          return {ok:true,data:{selected:'C:/DemoProject',readOnly:true,writeEnabled:false}};
        }
        if (req.operation === 'list') return {ok:true,data:{relativePath:'',entries:[
          {kind:'file',name:'sample.ts',relativePath:'frontend/src/app/sample.ts'},
        ]}};
        if (req.operation === 'read') return {ok:true,data:{relativePath:'frontend/src/app/sample.ts',
          content:'export const x = 1;',size:19}};
        return {ok:false,error:'DENIED'};
      },
      agentProposalApi: async (req: any) => {
        if (req.operation === 'list') return {ok:true,status:200,data:[]};
        if (req.operation === 'patch-preview') return {ok:true,status:200,data:{
          relativePath:req.source.relativePath,original:req.source.content,
          proposed:'export const x = 2;',diff:'-export const x = 1;\n+export const x = 2;',
          notice:'Bez zapisu',
        }};
        return {ok:false,status:400,error:'UNSUPPORTED'};
      },
      agentProjectTest: async (req: any) => {
        (window as any).__projectTestCalls.push(req);
        return {status:'passed',scope:'frontend',message:'ng build i Vitest OK',copiedFiles:123};
      },
    };
  });
  await page.goto('/');
  const panel = page.getByTestId('agent-planner');
  const switcher = page.locator('app-module-switcher');
  const select = switcher.locator('select').first();
  if (await select.count()) {
    const option = await select.locator('option').evaluateAll(opts => opts.map(o => ({
      value:(o as HTMLOptionElement).value,label:o.textContent?.trim() ?? '',
    })).find(o => o.value === 'lab' || /AI Lab/i.test(o.label)) ?? null);
    if (!option) throw new Error('AI Lab not found');
    await select.selectOption(option.value);
  } else {
    const next = switcher.getByRole('button').last();
    for (let i=0; i<12 && !(await panel.isVisible()); i++) await next.click();
  }
  await expect(panel).toBeVisible();
  const context = panel.getByTestId('agent-context');
  await context.evaluate((node: HTMLDetailsElement) => { node.open = true; });
  await context.getByTestId('agent-workspace-choose').click();
  await context.getByRole('button', {name:'sample.ts'}).click();
  await context.getByTestId('agent-attach-source').click();
  await panel.getByTestId('agent-task').fill('Zmień x na 2');
  await panel.getByTestId('agent-generate-diff').click();
  await expect(panel.getByTestId('agent-diff-result')).toBeVisible();
  const testPanel = panel.getByTestId('agent-project-test');
  const run = testPanel.getByTestId('agent-project-test-run');
  await expect(run).toBeDisabled();
  expect(await page.evaluate(() => (window as any).__projectTestCalls)).toHaveLength(0);
  await testPanel.getByTestId('agent-project-test-consent').check();
  await expect(run).toBeEnabled();
  await run.click();
  await expect(testPanel.getByTestId('agent-project-test-report')).toContainText('Testy zaliczone');
  expect(await page.evaluate(() => (window as any).__projectTestCalls)).toEqual([{
    operation:'test',relativePath:'frontend/src/app/sample.ts',
    original:'export const x = 1;',proposed:'export const x = 2;',
  }]);
  await expect(run).toBeDisabled();
});
