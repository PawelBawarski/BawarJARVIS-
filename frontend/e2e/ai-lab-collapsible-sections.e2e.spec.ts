import { expect, test } from '@playwright/test';

test('AI Lab sections are collapsible and the old fake Play/Stop is absent', async ({ page }) => {
  await page.goto('/lab');
  const research = page.getByTestId('ai-lab-research-section');
  const agent = page.getByTestId('ai-lab-agent-section');
  await expect(research).toHaveAttribute('open', '');
  await expect(agent).toHaveAttribute('open', '');
  await agent.locator(':scope > summary').click();
  await expect(agent).not.toHaveAttribute('open', '');
  await expect(research).toHaveAttribute('open', '');
  await expect(page.locator('.ai-lab-view__actions')).toHaveCount(0);
});
