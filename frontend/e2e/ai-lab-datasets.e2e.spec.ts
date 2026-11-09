import { test, expect } from '@playwright/test';

test('AI Lab creates a versioned dataset and uses separate train/validation examples', async ({page}) => {
  await page.addInitScript(() => {
    const datasetId = '123e4567-e89b-42d3-a456-426614174001';
    const versionId = '123e4567-e89b-42d3-a456-426614174002';
    let list: unknown[] = [];
    const split = {id:versionId,datasetId,name:'Próbki',versionNumber:1,
      validationSha256:'a'.repeat(64),trainingExamples:['a','b','c','d'],validationExamples:['e']};
    Object.defineProperty(window,'jarvisDesktop',{configurable:true,value:{
      aiLabApi:async (request:{operation:string; name?:string; examples?:string[]}) => {
        const payload:Record<string, unknown> = {
          state:{id:null,status:'IDLE',epoch:0,totalEpochs:0,losses:[],error:null},
          model:{vocabularySize:50,contextLength:128,trainedExamplesThisSession:0,checkpointAvailable:false,restoredFromCheckpoint:false},
          historyRuns:[], historyCheckpoints:[], historyEvaluations:[],
          datasetList:list,
          datasetCreate:{id:versionId,datasetId,versionNumber:1,trainingCount:4,validationCount:1},
          datasetVersions:[{id:versionId,datasetId,versionNumber:1,trainingCount:4,validationCount:1}],
          datasetRead:split,
        };
        if (request.operation==='datasetCreate') {
          list=[{id:datasetId,name:request.name,latestVersion:1,latestVersionId:versionId,trainingCount:4,validationCount:1}];
        }
        if (request.operation==='datasetList') payload.datasetList=list;
        if (request.operation==='datasetCreate') {
          return {ok:true,status:201,data:payload.datasetCreate};
        }
        return {ok:true,status:200,data:payload[request.operation] || {status:'COMPLETED'}};
      },
    }});
  });
  await page.goto('/');
  const switcher=page.locator('select').filter({has:page.locator('option')}).first();
  await expect(switcher).toBeVisible();
  const options=await switcher.locator('option').allTextContents();
  const aiLab=options.find(x=>/ai lab|laboratorium ai/i.test(x));
  expect(aiLab).toBeTruthy();
  await switcher.selectOption({label:aiLab!});
  await expect(page.getByTestId('ai-lab-datasets')).toBeVisible();
  await page.getByTestId('dataset-name').fill('Próbki');
  await page.getByTestId('dataset-examples').fill('a\nb\nc\nd\ne');
  await page.getByTestId('dataset-create').click();
  await expect(page.getByTestId('dataset-split')).toContainText('4');
  await expect(page.getByTestId('dataset-train')).toBeEnabled();
  await expect(page.getByTestId('dataset-evaluate')).toBeEnabled();
});
