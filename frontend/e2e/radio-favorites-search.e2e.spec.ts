import { expect, test } from '@playwright/test';

test('Radio station dropdown searches internally and favorites controls remain on one row', async ({ page }) => {
  let favorites: any[] = [];
  await page.route('**/api/radio/stations?**', route => route.fulfill({ json: [
    { id: 'one', name: 'Alpha FM', countryCode: 'PL', streamUrl: 'https://radio.example.org/one.mp3' },
    { id: 'two', name: 'Beta FM', countryCode: 'PL', streamUrl: 'https://radio.example.org/two.mp3' },
  ] }));
  await page.route('**/api/radio/favorites**', async route => {
    const req = route.request();
    if (req.method() === 'GET') return route.fulfill({ json: favorites });
    if (req.method() === 'POST') { favorites = [req.postDataJSON(), ...favorites]; return route.fulfill({ status: 204 }); }
    if (req.method() === 'DELETE') { favorites = []; return route.fulfill({ status: 204 }); }
    return route.continue();
  });
  await page.goto('/chat');
  await page.getByTestId('radio-trigger').click();
  await expect(page.getByTestId('radio-search')).toHaveCount(0);
  await expect(page.locator('#radio-station')).toContainText('Alpha FM');
  const checkbox = page.getByTestId('radio-favorites-only');
  const selector = page.getByTestId('radio-station-trigger');
  const selectBox = await selector.boundingBox();
  const checkBox = await checkbox.boundingBox();
  expect(selectBox && checkBox && checkBox.y > selectBox.y).toBeTruthy();
  await selector.click();
  await page.getByTestId('radio-search').fill('Beta');
  await expect(page.locator('[role="listbox"] [role="option"]')).toHaveCount(1);
  await page.getByRole('option', { name: 'Beta FM' }).click();
  await expect(selector).toContainText('Beta FM');
  await expect(page.getByTestId('radio-search')).toHaveCount(0);
  await page.getByTestId('radio-favorite-toggle').click();
  await expect(page.getByTestId('radio-favorite-toggle')).toHaveAttribute('aria-pressed', 'true');
  const controls = page.locator('.radio-panel__controls');
  const buttons = controls.locator('button');
  await expect(buttons).toHaveCount(4);
  const boxes = await buttons.evaluateAll(elements => elements.map(el => { const r = el.getBoundingClientRect(); return {x:r.x,y:r.y}; }));
  expect(boxes.every(b => Math.abs(b.y - boxes[0].y) < 2)).toBe(true);
  expect(boxes.map(b => b.x)).toEqual([...boxes.map(b => b.x)].sort((a,b) => a-b));
  await page.locator('.radio-panel__close').click();
  await page.getByTestId('radio-trigger').click();
  await expect(page.getByTestId('radio-favorite-toggle')).toHaveAttribute('aria-pressed', 'true');
});
