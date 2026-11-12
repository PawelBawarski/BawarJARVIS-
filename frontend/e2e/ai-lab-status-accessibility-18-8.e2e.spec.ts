import { expect, test } from '@playwright/test';

const proposal = {
  id: '8ef71522-27d0-4f9b-9bb3-d0245b9bf440',
  task: 'Refactor service', plan: '1. Add unit tests.\n2. Refactor service.',
  status: 'PENDING', createdAt: '2026-11-12T10:00:00Z', updatedAt: '2026-11-12T10:00:00Z',
};

test('18.8: accessible activity updates without sending code before explicit generation', async ({ page }) => {
  const requests: unknown[] = [];
  await page.route('**/api/agent/proposals', async route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    requests.push(route.request().postDataJSON());
    await new Promise(resolve => setTimeout(resolve, 450));
    return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(proposal) });
  });
  await page.route('**/api/agent/proposals/*/decision', async route => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      ...proposal, status: 'APPROVED',
    }) });
  });
  await page.goto('/lab');
  const planner = page.getByTestId('agent-planner');
  const activity = planner.getByTestId('agent-activity');
  await expect(activity.getByRole('status')).toContainText('Gotowe do opisania zadania');
  await expect(planner.getByTestId('agent-workflow-guide').locator('li[aria-current="step"]')).toHaveCount(1);

  const context = planner.getByTestId('agent-context');
  await context.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(context).toHaveAttribute('open', '');
  await context.getByTestId('agent-web-path').fill('frontend/src/app/demo.ts');
  await context.getByTestId('agent-web-code').fill('export const x = 1;');
  await context.getByTestId('agent-web-attach').click();
  await expect(activity.getByRole('status')).toContainText('dodane do kontekstu');
  expect(requests).toHaveLength(0);

  await planner.getByTestId('agent-task').fill('Refactor service');
  await planner.getByTestId('agent-generate').click();
  await expect(activity).toHaveAttribute('data-busy', 'true');
  await expect(activity.getByRole('status')).toContainText('Generowanie planu');
  await expect(planner.getByTestId('agent-status')).toContainText('Do oceny');
  await expect(activity).toHaveAttribute('data-busy', 'false');
  expect(requests).toEqual([{ task: 'Refactor service', sources: [
    { relativePath: 'frontend/src/app/demo.ts', content: 'export const x = 1;' },
  ] }]);
  await planner.getByTestId('agent-approve').click();
  await expect(activity.getByRole('status')).toContainText('zatwierdzony');
  await expect(planner.getByTestId('agent-status')).toContainText('Zaakceptowany plan');
  expect(requests).toHaveLength(2);
  await expect(planner).toContainText('nie zapisuje plików');
});

test('18.8: activity and proposal status follow the selected language', async ({ page }) => {
  await page.route('**/api/agent/proposals', async route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([proposal]),
  }));
  await page.goto('/lab');
  const activity = page.getByTestId('agent-activity');
  await expect(activity.getByRole('status')).toContainText('oczekuje na Twoją decyzję');
  await page.getByRole('button', { name: 'Otwórz ustawienia' }).click();
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(activity.getByRole('status')).toContainText('waiting for your decision');
  await expect(page.getByTestId('agent-status')).toHaveText('Pending review');
});
