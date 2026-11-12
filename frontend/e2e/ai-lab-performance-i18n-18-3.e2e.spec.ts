import { expect, test } from '@playwright/test';

test('18.3: AI Lab explains its actions, defers advanced tools and follows the chosen language', async ({ page }) => {
  await page.goto('/');
  const menu = page.locator('#jarvis-module-select');
  await menu.selectOption('lab');
  await expect(page.getByTestId('ai-lab-explainer')).toBeVisible();
  await expect(page.getByTestId('agent-workflow-status')).toBeVisible();
  await expect(page.getByTestId('agent-workflow-guide')).toBeVisible();
  await expect(page.getByTestId('ai-lab-safety-note')).toContainText('nie zapisuje');
  // Heavy training and offline tools should not start while disclosures are closed.
  await expect(page.getByTestId('ai-lab-training')).toHaveCount(0);
  await expect(page.getByTestId('learning-lab')).toHaveCount(0);
  await page.getByTestId('jarvis-lab-existing').locator('summary').click();
  await expect(page.getByTestId('ai-lab-training')).toBeAttached();
  await page.getByTestId('jarvis-lab-offline').locator('summary').click();
  await expect(page.getByTestId('learning-lab')).toBeAttached();
});

test('18.3: module switching never mounts AI Lab before its first visit', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('app-chat-view')).toBeVisible();
  await expect(page.locator('app-ai-lab-view')).toHaveCount(0);
  await page.locator('#jarvis-module-select').selectOption('lab');
  await expect(page.locator('app-ai-lab-view')).toBeVisible();
  await page.locator('#jarvis-module-select').selectOption('chat');
  // Preserve entered AI Lab state after a module switch (one-time @defer trigger).
  await expect(page.locator('app-ai-lab-view')).toBeAttached();
});
