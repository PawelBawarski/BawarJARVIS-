import { test, expect } from '@playwright/test';

// Works without launching the optional Offline Brain service.
test('AI Lab uses one consistent, contained dashboard and exposes advanced tools on demand', async ({ page }) => {
  await page.goto('/');
  const dashboard = page.getByTestId('jarvis-lab-ux');
  if (!(await dashboard.isVisible().catch(() => false))) {
    const nav = page.getByRole('combobox').first();
    if (await nav.count()) {
      try { await nav.selectOption({ label: 'AI Lab' }); } catch { await page.getByText('AI Lab', { exact:true }).first().click(); }
    } else {
      await page.getByText('AI Lab', { exact:true }).first().click();
    }
  }
  await expect(dashboard).toBeVisible();
  await expect(dashboard.getByText('Centrum rozwoju Jarvisa')).toBeVisible();
  await expect(dashboard.getByText('Wiedza i internet')).toBeVisible();
  const advanced = page.getByTestId('jarvis-lab-offline');
  await expect(advanced).toBeVisible();
  await expect(page.getByTestId('learning-lab')).toBeHidden();
  await advanced.locator('summary').click();
  await expect(page.getByTestId('learning-lab')).toBeVisible();
  await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});
