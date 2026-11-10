import { expect, test } from '@playwright/test';

test('manual syntax check reports pass; no file write or execution bridge', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__sandboxCalls = [];
    (window as any).jarvisDesktop = {
      ...((window as any).jarvisDesktop ?? {}),
      workspaceApi: async (req: any) => {
        if (req.operation === 'choose' || req.operation === 'status')
          return {ok:true,data:{selected:'C:/DemoProject',readOnly:true,writeEnabled:false}};
        if (req.operation === 'list') return {ok:true,data:{relativePath:'',entries:[
          {kind:'file', name:'sample.ts', relativePath:'frontend/src/app/sample.ts'},
        ]}};
        if (req.operation === 'read') return {ok:true,data:{relativePath:'frontend/src/app/sample.ts',
          content:'export const x = 1;',size:19}};
        return {ok:false,error:'DENIED'};
      },
      agentProposalApi: async (req: any) => {
        if (req.operation === 'list') return {ok:true,status:200,data:[]};
        if (req.operation === 'patch-preview') return {ok:true,status:200,data:{
          relativePath:req.source.relativePath, original:req.source.content,
          proposed:'export const x = 2;', diff:'-export const x = 1;\n+export const x = 2;',
          notice:'Nie zapisano',
        }};
        return {ok:false,status:400,error:'UNSUPPORTED'};
      },
      sandboxCheck: async (req: any) => {
        (window as any).__sandboxCalls.push(req);
        return {status:'passed',language:'.ts',message:'Składnia poprawna. Bez uruchamiania.'};
      },
    };
  });
  await page.goto('/');
  const panel = page.getByTestId('agent-planner');
  const switcher = page.locator('app-module-switcher');
  const select = switcher.locator('select').first();
  if (await select.count()) {
    const opt = await select.locator('option').evaluateAll(options => options.map(o => ({
      value:(o as HTMLOptionElement).value, label:o.textContent?.trim() ?? '',
    })).find(o => o.value === 'lab' || /AI Lab/i.test(o.label)) ?? null);
    if (!opt) throw new Error('AI Lab not found');
    await select.selectOption(opt.value);
  } else {
    const next = switcher.getByRole('button').last();
    for (let i=0; i<12 && !(await panel.isVisible()); i++) await next.click();
  }
  await expect(panel).toBeVisible();
  const details = panel.getByTestId('agent-context');
  await details.evaluate((node: HTMLDetailsElement) => { node.open = true; });
  await details.getByTestId('agent-workspace-choose').click();
  await details.getByRole('button', {name:'sample.ts'}).click();
  await details.getByTestId('agent-attach-source').click();
  await panel.getByTestId('agent-task').fill('Zmień x na 2');
  await panel.getByTestId('agent-generate-diff').click();
  await expect(panel.getByTestId('agent-diff-result')).toBeVisible();
  expect(await page.evaluate(() => (window as any).__sandboxCalls.length)).toBe(0);
  await panel.getByTestId('agent-sandbox-check').click();
  await expect(panel.getByTestId('agent-sandbox-report')).toContainText('Składnia poprawna');
  expect(await page.evaluate(() => (window as any).__sandboxCalls)).toEqual([{
    operation:'check', relativePath:'frontend/src/app/sample.ts',
    original:'export const x = 1;', proposed:'export const x = 2;',
  }]);
});
