import { test, expect } from '@playwright/test';

test('20.3: semantic indexing is explicit, lexical fallback remains usable', async ({ page }) => {
  let indexCalls = 0;
  let searches = 0;
  await page.route('**/api/research/semantic/status', route => route.fulfill({ json: {
    configured: true, model: 'jarvis-qwen3-embedding-0.6b', knowledgeCount: 2,
    indexedCount: indexCalls, batchLimit: 5, scanLimit: 5000,
  }}));
  await page.route('**/api/research/semantic/index-next', route => {
    indexCalls++;
    return route.fulfill({ json: { processed: 2, indexedCount: 2, knowledgeCount: 2 } });
  });
  await page.route('**/api/research/semantic/search?*', route => {
    searches++;
    return route.fulfill({ json: [{ id: '1', title: 'Transformer', url: 'jarvis://note/1',
      excerpt: 'Magnetic induction and voltage.', method: 'semantic', similarity: .78 }] });
  });
  await page.goto('/lab');
  const panel = page.getByTestId('memory-semantic');
  await expect(panel).toBeVisible();
  expect(indexCalls).toBe(0);
  await panel.getByTestId('semantic-status-refresh').click();
  await expect(panel.getByTestId('semantic-status')).toBeVisible();
  expect(indexCalls).toBe(0);
  await panel.getByTestId('semantic-index').click();
  expect(indexCalls).toBe(1);
  expect(searches).toBe(0);
  await panel.getByTestId('semantic-query').fill('How do voltage transformers work?');
  await panel.getByTestId('semantic-search').click();
  await expect(panel.getByTestId('semantic-hits')).toContainText('Transformer');
  expect(searches).toBe(1);
});
