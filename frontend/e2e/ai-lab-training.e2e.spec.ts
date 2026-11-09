import { test, expect } from '@playwright/test';

test('AI Lab renders training controls and reflects backend progress', async ({page}) => {
  await page.addInitScript(() => {
    const state = {id:'demo',status:'RUNNING',epoch:2,totalEpochs:3,losses:[1.4,1.1],error:null};
    Object.defineProperty(window,'jarvisDesktop',{configurable:true,value:{
      aiLabApi: async (request:{operation:string}) => ({
        ok:true,status:200,data:request.operation==='model' ?
          {vocabularySize:50,contextLength:128,trainedExamplesThisSession:2,checkpointAvailable:false,restoredFromCheckpoint:false} : state,
      })
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
  await expect(page.getByTestId('ai-lab-training')).toBeVisible();
  await expect(page.getByTestId('ai-lab-status')).toHaveText('RUNNING');
  await expect(page.getByTestId('ai-lab-start')).toBeDisabled();
});
