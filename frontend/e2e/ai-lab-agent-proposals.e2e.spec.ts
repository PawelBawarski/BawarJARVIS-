import { expect, test } from '@playwright/test';

test('Qwen proposal appears for review; approval changes status without executing code', async ({ page }) => {
  await page.addInitScript(() => {
    const id = '8ef71522-27d0-4f9b-9bb3-d0245b9bf440';
    let saved: any[] = [];
    const existing = (window as any).jarvisDesktop || {};
    (window as any).jarvisDesktop = {
      ...existing,
      agentProposalApi: async (request: any) => {
        if (request.operation === 'list') return { ok: true, status: 200, data: saved };
        if (request.operation === 'generate') {
          const created = {
            id, task: request.task, plan: '1. Przygotuj testy.\n2. Zmodyfikuj Angular.\n3. Uruchom testy.',
            status: 'PENDING', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          };
          saved = [created];
          return { ok: true, status: 201, data: created };
        }
        if (request.operation === 'decide') {
          saved[0] = { ...saved[0], status: request.decision };
          return { ok: true, status: 200, data: saved[0] };
        }
        return { ok: false, status: 400, error: 'UNSUPPORTED' };
      },
    };
  });
  await page.goto('/');
  const panel = page.getByTestId('agent-planner');
  // The workspace keeps ALL modules in the DOM and hides inactive ones.
  // Use the real module switcher to activate AI Lab before checking visibility.
  const switcher = page.locator('app-module-switcher');
  await expect(switcher).toBeVisible();
  const nativeSelect = switcher.locator('select').first();
  if (await nativeSelect.count()) {
    const labOption = await nativeSelect.locator('option').evaluateAll(options =>
      options.map(option => ({
        value: (option as HTMLOptionElement).value,
        label: option.textContent?.trim() ?? '',
      })).find(option => option.value === 'lab' || /AI Lab/i.test(option.label)) ?? null,
    );
    if (!labOption) throw new Error('AI Lab not found in module select');
    await nativeSelect.selectOption(labOption.value);
  } else {
    // Custom switchers have Previous, Select and Next controls.
    // Navigate by the public Next button until AI Lab becomes visible.
    const buttons = switcher.getByRole('button');
    const count = await buttons.count();
    if (count < 2) throw new Error('Unexpected module switcher markup; cannot navigate to AI Lab');
    const next = buttons.last();
    for (let step = 0; step < 12 && !(await panel.isVisible()); step++) {
      await next.click();
    }
  }
  await expect(panel).toBeVisible();
  await panel.getByTestId('agent-task').fill('Dodaj wyszukiwarkę historii czatów');
  await panel.getByTestId('agent-generate').click();
  await expect(panel.getByTestId('agent-plan')).toContainText('Przygotuj testy');
  await expect(panel.getByTestId('agent-status')).toHaveText('Do oceny');
  await panel.getByTestId('agent-approve').click();
  await expect(panel.getByTestId('agent-status')).toHaveText('Zaakceptowany plan');
  await expect(panel.getByTestId('agent-approve')).toHaveCount(0);
  await expect(panel.getByText('Nie wykonano żadnych zmian plików.')).toBeVisible();
});
