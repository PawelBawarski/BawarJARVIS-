import { expect, test } from '@playwright/test';

test('18.5: both AI Lab training panels share a single status poller and stop when completed', async ({ page }) => {
  let reads = 0;
  await page.route('**/api/ai-lab/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/ai-lab/training' && route.request().method() === 'GET') {
      reads++;
      await route.fulfill({ json: {
        id: 'task-1', status: reads < 2 ? 'RUNNING' : 'COMPLETED',
        epoch: reads < 2 ? 1 : 3, totalEpochs: 3, losses: [], error: null,
      }});
      return;
    }
    if (url.pathname === '/api/ai-lab/model') {
      await route.fulfill({ json: {
        vocabularySize: 0, contextLength: 0, trainedExamplesThisSession: 0,
        checkpointAvailable: false, restoredFromCheckpoint: false,
      }});
      return;
    }
    await route.fulfill({ json: [] });
  });

  await page.goto('/lab');
  await page.getByTestId('jarvis-lab-existing').locator('summary').click();
  await expect(page.getByTestId('ai-lab-training')).toBeVisible();
  await expect.poll(() => reads, { timeout: 8_000 }).toBe(2);
  await expect(page.getByTestId('ai-lab-status')).toHaveText('COMPLETED');
  await page.waitForTimeout(2_400);
  expect(reads).toBe(2);
  await page.getByTestId('jarvis-lab-existing').locator('summary').click();
  await expect(page.getByTestId('ai-lab-training')).toHaveCount(0);
  await page.waitForTimeout(2_400);
  expect(reads).toBe(2);
});
