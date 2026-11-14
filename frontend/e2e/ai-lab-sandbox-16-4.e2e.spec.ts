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
  await page.goto('/lab');
  const panel = page.getByTestId('agent-planner');
  await expect(panel).toBeVisible();
  const details = panel.getByTestId('agent-context');
  await revealWorkspaceChooser(details);
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
