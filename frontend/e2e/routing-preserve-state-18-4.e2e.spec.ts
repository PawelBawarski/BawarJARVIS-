import { expect, test } from '@playwright/test';

test.describe('18.4: SPA routing and in-memory form state', () => {
  test('root and invalid paths redirect to Chat, deep links load modules', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/chat$/);
    await expect(page.locator('app-chat-view')).toBeVisible();

    await page.goto('/lab');
    await expect(page.getByTestId('ai-lab-explainer')).toBeVisible();
    await expect(page.locator('#jarvis-module-select')).toHaveValue('lab');

    await page.goto('/security');
    await expect(page.locator('app-security-dashboard')).toBeVisible();
    await expect(page.locator('#jarvis-module-select')).toHaveValue('security');

    await page.goto('/unknown-module');
    await expect(page).toHaveURL(/\/chat$/);
  });

  test('Back/Forward preserve unsent Chat and AI Lab drafts without localStorage', async ({ page }) => {
    await page.goto('/chat');
    const chat = page.getByTestId('chat-input');
    await expect(chat).toBeVisible();
    await chat.fill('Niewysłany szkic rozmowy');

    await page.locator('#jarvis-module-select').selectOption('lab');
    await expect(page).toHaveURL(/\/lab$/);
    const task = page.getByTestId('agent-task');
    await expect(task).toBeVisible();
    await task.fill('Sprawdź bezpieczeństwo kodu Angular');

    await page.goBack();
    await expect(page).toHaveURL(/\/chat$/);
    await expect(chat).toHaveValue('Niewysłany szkic rozmowy');

    await page.goForward();
    await expect(page).toHaveURL(/\/lab$/);
    await expect(task).toHaveValue('Sprawdź bezpieczeństwo kodu Angular');
  });

  test('sidebar returns to chat with correct URL and active indicator', async ({ page }) => {
    await page.goto('/lab');
    await page.locator('.sidebar .nav-item').click();
    await expect(page).toHaveURL(/\/chat$/);
    await expect(page.locator('.sidebar .nav-item')).toHaveAttribute('aria-current', 'page');
  });
});
