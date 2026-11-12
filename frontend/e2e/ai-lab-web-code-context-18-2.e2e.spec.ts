import { expect, test } from '@playwright/test';

test('18.2: web file is sent to Qwen only after explicit consent; preview never writes files', async ({ page }) => {
  const submitted: any[] = [];
  let previewCalls = 0;

  await page.route('**/api/agent/proposals', async route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    const payload = route.request().postDataJSON();
    submitted.push(payload);
    return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({
      id: '8ef71522-27d0-4f9b-9bb3-d0245b9bf440',
      task: payload.task, plan: 'Plan przygotowany na podstawie zatwierdzonego kodu.',
      status: 'PENDING', createdAt: '2026-11-12T08:00:00Z', updatedAt: '2026-11-12T08:00:00Z',
    }) });
  });
  await page.route('**/api/agent/patch-preview', async route => {
    previewCalls++;
    const body = route.request().postDataJSON();
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      relativePath: body.source.relativePath,
      original: body.source.content,
      proposed: 'export const answer = 43;',
      diff: '-export const answer = 42;\n+export const answer = 43;',
      notice: 'Nic nie zapisano na dysku.',
    }) });
  });

  await page.goto('/');
  const panel = page.getByTestId('agent-planner');
  const switcher = page.locator('app-module-switcher');
  const select = switcher.locator('select').first();
  if (await select.count()) {
    const option = await select.locator('option').evaluateAll(options =>
      options.map(option => ({
        value: (option as HTMLOptionElement).value,
        label: option.textContent?.trim() ?? '',
      })).find(option => option.value === 'lab' || /AI Lab/i.test(option.label)) ?? null,
    );
    if (!option) throw new Error('AI Lab not found');
    await select.selectOption(option.value);
  } else {
    const next = switcher.getByRole('button').last();
    for (let step = 0; step < 12 && !(await panel.isVisible()); step++) await next.click();
  }
  await expect(panel).toBeVisible();

  const context = panel.getByTestId('agent-context');
  await context.evaluate(el => { (el as HTMLDetailsElement).open = true; });
  await context.getByTestId('agent-web-file').setInputFiles({
    name: 'example.ts', mimeType: 'text/plain', buffer: Buffer.from('export const answer = 42;'),
  });
  await expect(context.getByTestId('agent-web-code')).toHaveValue('export const answer = 42;');
  await expect(context.getByTestId('agent-selected-sources')).toHaveCount(0);
  expect(submitted).toHaveLength(0);
  await context.getByTestId('agent-web-path').fill('frontend/src/app/example.ts');
  await context.getByTestId('agent-web-attach').click();
  await expect(context.getByTestId('agent-selected-sources')).toContainText('frontend/src/app/example.ts');
  expect(submitted).toHaveLength(0);

  await panel.getByTestId('agent-task').fill('Popraw funkcję w kodzie');
  await panel.getByTestId('agent-generate').click();
  await expect(panel.getByTestId('agent-plan')).toContainText('Plan przygotowany');
  expect(submitted).toEqual([{
    task: 'Popraw funkcję w kodzie',
    sources: [{ relativePath: 'frontend/src/app/example.ts', content: 'export const answer = 42;' }],
  }]);

  await panel.getByTestId('agent-generate-diff').click();
  await expect(panel.getByTestId('agent-diff-text')).toContainText('+export const answer = 43;');
  expect(previewCalls).toBe(1);
});
