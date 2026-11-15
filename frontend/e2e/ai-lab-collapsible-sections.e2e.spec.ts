import { test, expect } from '@playwright/test';

test('AI Lab starts with three closed areas and training controls appear on demand', async ({page}) => {
  await page.goto('/lab');
  const sections = page.locator('[data-testid="jarvis-lab-ux"] > details');
  await expect(sections).toHaveCount(3);
  const knowledge = page.getByTestId('ai-lab-research-section');
  const training = page.getByTestId('ai-lab-training-section');
  const agent = page.getByTestId('ai-lab-agent-section');
  for (const section of [knowledge,training,agent]) await expect(section).not.toHaveAttribute('open','');
  await expect(page.getByRole('button',{name:'Jak działa AI Lab?'})).toHaveCount(0);
  await training.locator(':scope > summary').click();
  await expect(training).toHaveAttribute('open','');
  await expect(page.getByTestId('lora-dataset')).toBeVisible();
  await expect(knowledge).not.toHaveAttribute('open','');
  await expect(agent).not.toHaveAttribute('open','');
});
