import { test, expect } from '@playwright/test';

// Works without launching the optional Offline Brain service.
test('AI Lab uses one consistent, contained dashboard and exposes advanced tools on demand', async ({ page }) => {
  await page.goto('/lab');
  const dashboard = page.getByTestId('jarvis-lab-ux');
  await expect(dashboard).toBeVisible();
  await expect(dashboard.locator('.jarvis-lab-ux__overview .jarvis-lab-ux__tile')).toHaveCount(4);
  await expect(page.getByTestId('research-memory')).toBeVisible();
  await expect(page.getByTestId('agent-planner')).toBeVisible();

  const offlineSection = page.getByTestId('jarvis-lab-offline');
  await expect(offlineSection.locator('summary')).toBeVisible();
  await expect(page.getByTestId('learning-lab')).toHaveCount(0);

  await offlineSection.locator('summary').click();
  await expect(offlineSection).toHaveJSProperty('open', true);
  await expect(page.getByTestId('learning-lab')).toBeVisible();

  await expect.poll(async () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);
});
