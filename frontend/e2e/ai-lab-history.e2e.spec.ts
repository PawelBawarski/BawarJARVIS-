import { test, expect } from '@playwright/test';

test('AI Lab displays saved training history and compares snapshots safely', async ({page}) => {
  await page.addInitScript(() => {
    const id1 = '123e4567-e89b-42d3-a456-426614174000';
    const id2 = '123e4567-e89b-42d3-a456-426614174001';
    const ckpt = (id: string, sha: string, hash: string, ppl: number) => ({
      id, trainingRunId:null, createdAt:'2026-11-09T12:00:00Z',
      modelVersion:'jarvis-tiny-v1', fileBytes:2048, sha256:sha,
      trainingLoss:0.25, evaluationPerplexity:ppl, evaluationCorpusSha256:hash,
    });
    const responses: Record<string,unknown> = {
      state: {id:null,status:'IDLE',epoch:0,totalEpochs:0,losses:[],error:null},
      model: {vocabularySize:50,contextLength:128,trainedExamplesThisSession:10,checkpointAvailable:true,restoredFromCheckpoint:false},
      historyRuns: [{id:id1,status:'completed',startedAt:'2026-11-09T11:00:00Z',finishedAt:'2026-11-09T11:01:00Z',totalEpochs:2,completedEpochs:2,exampleCount:2,finalLoss:0.2,error:null}],
      historyEpochs: [{epoch:1,loss:0.8},{epoch:2,loss:0.2}],
      historyCheckpoints: [ckpt(id1,'a'.repeat(64),'c'.repeat(64),1.3),ckpt(id2,'b'.repeat(64),'d'.repeat(64),1.1)],
      historyEvaluations: [],
    };
    Object.defineProperty(window,'jarvisDesktop',{configurable:true,value:{
      aiLabApi:async (req:{operation:string}) => ({ok:true,status:200,data:responses[req.operation]}),
    }});
  });
  await page.goto('/');
  const switcher=page.locator('select').filter({has:page.locator('option')}).first();
  await expect(switcher).toBeVisible();
  const options=await switcher.locator('option').allTextContents();
  const label=options.find(x=>/ai lab|laboratorium ai/i.test(x));
  expect(label).toBeTruthy();
  await switcher.selectOption({label:label!});
  await expect(page.getByTestId('ai-lab-history')).toBeVisible();
  await expect(page.getByTestId('ai-lab-history-runs').locator('tbody tr')).toHaveCount(1);
  await expect(page.getByTestId('ai-lab-epoch-metrics')).toContainText('#2');
  await expect(page.getByTestId('ai-lab-history-checkpoints').locator('tbody tr')).toHaveCount(2);
  await expect(page.getByTestId('ai-lab-noncomparable')).toBeVisible();
});
