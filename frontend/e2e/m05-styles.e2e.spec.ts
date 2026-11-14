import { expect, test } from '@playwright/test';

test.describe('M05 — styles after Sass relocation', () => {
  test('Chat preserves its flex layout', async ({ page }) => {
    await page.goto('/chat');
    const chat = page.locator('app-chat-view .chat');
    await expect(chat).toBeVisible();
    await expect(chat).toHaveCSS('display', 'flex');
  });

  test('AI Lab preserves its grid layout', async ({ page }) => {
    await page.goto('/lab');
    const lab = page.locator('app-ai-lab-view .jarvis-lab-ux');
    await expect(lab).toBeVisible();
    await expect(lab).toHaveCSS('display', 'grid');
  });
});
