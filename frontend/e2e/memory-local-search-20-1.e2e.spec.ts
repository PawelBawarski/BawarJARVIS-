import { test, expect } from '@playwright/test';

test('20.1: manual memory requires explicit save and supports local search', async ({ page }) => {
  let saves = 0;
  await page.route('**/api/research/notes', async route => {
    saves++;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      id: 'bca00000-0000-4000-a000-000000000001', title: 'Angular Signals',
      excerpt: 'Signals track changes', url: 'jarvis://note/bca00000-0000-4000-a000-000000000001'
    }) });
  });
  await page.route('**/api/research/matches?*', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([{
      id: 'bca00000-0000-4000-a000-000000000001', title: 'Angular Signals',
      excerpt: 'Signals track changes', url: 'jarvis://note/bca00000-0000-4000-a000-000000000001'
    }])
  }));
  await page.goto('/lab');
  await expect(page.getByTestId('memory-local-note')).toBeVisible();
  await page.getByTestId('memory-note-title').fill('Angular Signals');
  await page.getByTestId('memory-note-content').fill('Signals track changes');
  expect(saves).toBe(0);
  await page.getByTestId('memory-note-save').click();
  await expect(page.getByTestId('research-notes')).toContainText('Angular Signals');
  expect(saves).toBe(1);
  await page.getByTestId('memory-search-input').fill('Signals');
  await page.getByTestId('memory-search-submit').click();
  await expect(page.getByTestId('memory-search-results')).toContainText('Angular Signals');
  await expect(page.getByTestId('memory-search-results')).not.toContainText('Open source');
});
