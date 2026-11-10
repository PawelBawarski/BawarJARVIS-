import {test,expect} from '@playwright/test';
test('research center exists and provides in-app instructions',async({page})=>{
  await page.goto('/');
  const lab=page.getByTestId('research-memory');
  // AI Lab may initially be hidden behind module navigation.
  if (!(await lab.isVisible().catch(()=>false))) {
    const nav=page.getByRole('button',{name:/AI Lab/i}).first();
    if (await nav.isVisible().catch(()=>false)) await nav.click();
  }
  // JARVIS_16A_E2E_NAV_PREP_V1 — aktywuj moduł rzeczywistym przełącznikiem UI
  const jarvisAuditLabSelect = page.locator('app-module-switcher select').first();
  await expect(jarvisAuditLabSelect).toBeVisible();
  await jarvisAuditLabSelect.selectOption('lab');
  await expect(page.getByTestId('jarvis-lab-ux')).toBeVisible();
  await expect(lab).toBeVisible();
  await expect(lab.getByText('Internet i pamięć wiedzy')).toBeVisible();
  await lab.locator('summary').click();
  await expect(lab.getByText(/Wpisz „Angular Signals”/)).toBeVisible();
});
