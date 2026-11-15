import { test, expect } from '@playwright/test';

test('AI Lab: real LoRA Start/Stop, status and history without real GPU', async ({ page }) => {
  let started = false;
  await page.route('**/api/ai-lab/lora/**', async route => {
    const url = route.request().url();
    const status = { runId: started ? 'lora-20261115-135459-78ded70e' : null,
      status: started ? 'running' : 'idle', step: started ? 1 : 0, totalSteps: started ? 6 : 0,
      processAlive: started, loss: started ? 2.9 : null, vramMiB: started ? 1200 : null, error: null };
    if (url.endsWith('/datasets')) return route.fulfill({ json: [] });
    if (url.endsWith('/history')) return route.fulfill({ json: started ? [status] : [] });
    if (url.endsWith('/start')) { started = true; return route.fulfill({ json: { ...status, status: 'starting', processAlive: true } }); }
    if (url.endsWith('/stop')) { started = false; return route.fulfill({ json: { ...status, status: 'stopped', processAlive: false } }); }
    return route.fulfill({ json: status });
  });
  await page.goto('/lab');
  await page.getByTestId('ai-lab-training-section').locator(':scope > summary').click();
  const panel = page.getByTestId('lora-training');
  await expect(panel).toBeVisible();
  await expect(page.getByTestId('lora-stop')).toBeDisabled();
  await page.getByTestId('lora-steps').fill('201');
  await page.getByTestId('lora-start').click();
  await expect(panel.getByRole('alert')).toBeVisible();
  await page.getByTestId('lora-steps').fill('6');
  await page.getByTestId('lora-start').click();
  await expect(page.getByTestId('lora-stop')).toBeEnabled();
  await page.getByTestId('lora-stop').click();
  await expect(page.getByTestId('lora-start')).toBeEnabled();
});
