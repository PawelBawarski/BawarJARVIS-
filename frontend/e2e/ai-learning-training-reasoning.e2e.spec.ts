import { test, expect } from '@playwright/test';

// UI integration prerequisite: installer must have connected LearningLab to AiLabView.
test('AI Lab offline reasoner shows grounded result and keeps existing UI functional', async ({ page }) => {
  await page.route('http://127.0.0.1:8766/api/ai/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = path.endsWith('/reason')
      ? {answer:'4',mode:'calculator',sources:[],confidence:1,grounded:true,steps:[{step:'route',summary:'Kalkulator'}]}
      : path.endsWith('/status')
        ? {knowledgeDocuments:0,feedbackSamples:0,model:'logistic',llmAvailable:false,gpuAccelerated:false}
        : {documents:[]};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body),headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'}});
  });
  await page.goto('/');
  // JARVIS_16A_E2E_NAV_PREP_V1 — aktywuj moduł rzeczywistym przełącznikiem UI
  const jarvisAuditLabSelect = page.locator('app-module-switcher select').first();
  await expect(jarvisAuditLabSelect).toBeVisible();
  await jarvisAuditLabSelect.selectOption('lab');
  await expect(page.getByTestId('jarvis-lab-ux')).toBeVisible();
  await page.getByTestId('jarvis-lab-offline').evaluate(element => {
    (element as HTMLDetailsElement).open = true;
  });
  const panel = page.getByTestId('learning-lab');
  if (!(await panel.isVisible().catch(() => false))) {
    const tab = page.getByText('AI Lab', { exact: true }).first();
    await tab.click();
  }
  await expect(panel).toBeVisible();
  await panel.getByLabel('Token lokalnego API').fill('playwright-fake-token');
  await panel.getByLabel('Pytanie').fill('2+2');
  await panel.getByRole('button',{name:'Zadaj pytanie'}).click();
  await expect(panel.getByTestId('offline-answer')).toContainText('4');
});
