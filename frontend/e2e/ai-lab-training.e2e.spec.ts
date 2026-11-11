import { test, expect } from '@playwright/test';

test('AI Lab renders training controls and reflects backend progress', async ({page}) => {
  const uiErrors: string[] = [];
  page.on('pageerror', error => uiErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && message.text().startsWith('ERROR ')) {
      uiErrors.push(message.text());
    }
  });
  await page.addInitScript(() => {
    const state = {id:'demo',status:'RUNNING',epoch:2,totalEpochs:3,losses:[1.4,1.1],error:null};
    Object.defineProperty(window,'jarvisDesktop',{configurable:true,value:{
      aiLabApi: async (request:{operation:string}) => {
        if (request.operation === 'model') {
          return {ok:true,status:200,data:{vocabularySize:50,contextLength:128,trainedExamplesThisSession:2,checkpointAvailable:false,restoredFromCheckpoint:false}};
        }
        if (request.operation === 'state') return {ok:true,status:200,data:state};
        if (['datasetList','historyRuns','historyCheckpoints','historyEvaluations'].includes(request.operation)) {
          return {ok:true,status:200,data:[]};
        }
        return {ok:false,status:400,error:'UNSUPPORTED_TEST_OPERATION'};
      }
    }});
  });
  await page.goto('/');
  // The existing app registers its AI Lab module; only navigate when the option exists.
  const switcher = page.locator('select').filter({has:page.locator('option')}).first();
  await expect(switcher).toBeVisible();
  const options = await switcher.locator('option').allTextContents();
  const match=options.find(x=>/ai lab|laboratorium ai/i.test(x));
  expect(match, 'An AI Lab module must be registered').toBeTruthy();
  await switcher.selectOption({label:match!});
  // JARVIS_16A_E2E_NAV_PREP_V1 — aktywuj moduł rzeczywistym przełącznikiem UI
  const jarvisAuditLabSelect = page.locator('app-module-switcher select').first();
  await expect(jarvisAuditLabSelect).toBeVisible();
  await jarvisAuditLabSelect.selectOption('lab');
  await expect(page.getByTestId('jarvis-lab-ux')).toBeVisible();
  await page.getByTestId('jarvis-lab-existing').evaluate(element => {
    (element as HTMLDetailsElement).open = true;
  });
  await expect(page.getByTestId('ai-lab-training')).toBeVisible();
  await expect(page.getByTestId('ai-lab-status')).toHaveText('RUNNING');
  await expect(page.getByTestId('ai-lab-start')).toBeDisabled();
  expect(uiErrors).toEqual([]);
});
