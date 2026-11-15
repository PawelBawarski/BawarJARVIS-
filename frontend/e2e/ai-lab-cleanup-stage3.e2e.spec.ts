import { test, expect } from '@playwright/test';

test('AI Lab shows three collapsed sections and no legacy Java/Offline Brain panels', async ({ page }) => {
  await page.goto('/lab');
  await expect(page.getByTestId('ai-lab-research-section')).not.toHaveAttribute('open','');
  await expect(page.getByTestId('ai-lab-training-section')).not.toHaveAttribute('open','');
  await expect(page.getByTestId('ai-lab-agent-section')).not.toHaveAttribute('open','');
  await expect(page.getByTestId('jarvis-lab-offline')).toHaveCount(0);
  await expect(page.locator('app-ai-training-panel')).toHaveCount(0);
  await page.getByTestId('ai-lab-training-section').locator(':scope > summary').click();
  await expect(page.getByTestId('lora-dataset')).toBeVisible();
});
