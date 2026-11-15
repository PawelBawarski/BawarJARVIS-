import { test, expect } from '@playwright/test';

test('AI Lab has compact closed sections and consistent agent controls', async ({ page }) => {
  await page.goto('/lab');
  const lab = page.getByTestId('jarvis-lab-ux');
  await expect(lab).toBeVisible();
  const knowledge = page.getByTestId('ai-lab-research-section');
  const training = page.getByTestId('ai-lab-training-section');
  const agent = page.getByTestId('ai-lab-agent-section');
  for (const section of [knowledge, training, agent]) {
    await expect(section).not.toHaveAttribute('open', '');
  }
  await agent.locator(':scope > summary').click();
  await expect(agent).toHaveAttribute('open', '');
  const planner = page.getByTestId('agent-planner');
  await expect(planner).toBeVisible();
  const buttons = planner.locator('button:visible:not(:disabled)');
  if (await buttons.count()) {
    const style = await buttons.first().evaluate(el => {
      const s = getComputedStyle(el);
      return { radius: s.borderRadius, family: s.fontFamily };
    });
    expect(style.radius).not.toBe('0px');
    expect(style.family.length).toBeGreaterThan(0);
  }
  const history = planner.locator('.agent-planner__history-item').first();
  if (await history.count()) {
    const maxWidth = await history.evaluate(el => getComputedStyle(el).maxWidth);
    expect(maxWidth).toBe('270px');
  }
});
