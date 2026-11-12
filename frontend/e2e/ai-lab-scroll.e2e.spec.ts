import { test, expect } from '@playwright/test';

test('AI Lab can scroll vertically to the controls below the fold', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 520 });
  await page.goto('/');

  const switcher = page.locator('select').filter({ has: page.locator('option') }).first();
  await expect(switcher).toBeVisible();
  const labels = await switcher.locator('option').allTextContents();
  const aiLab = labels.find((label) => /ai lab|laboratorium ai/i.test(label));
  expect(aiLab, 'AI Lab must be present in the module switcher').toBeTruthy();
  await switcher.selectOption({ label: aiLab! });

  const lab = page.locator('app-ai-lab-view');
  await expect(lab).toBeVisible();

  const before = await lab.evaluate((element) => ({
    overflowY: getComputedStyle(element).overflowY,
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  }));

  expect(before.overflowY).toBe('auto');
  expect(before.scrollHeight).toBeGreaterThan(before.clientHeight);

  await lab.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect.poll(() => lab.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect(page.getByTestId('ai-lab-training')).toHaveCount(0);
  const advanced = page.getByTestId('jarvis-lab-existing');
  await advanced.evaluate(el => { (el as HTMLDetailsElement).open = true; el.dispatchEvent(new Event('toggle')); });
  await expect(page.getByTestId('ai-lab-training')).toBeAttached();
});
