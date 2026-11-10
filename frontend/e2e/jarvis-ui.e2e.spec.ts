import { test, expect } from '@playwright/test';

test('should open custom confirmation dialog when deleting chat', async ({ page }) => {
  // JARVIS_16A_E2E_MOCK_CHAT_V1 — bez rzeczywistego backendu i bazy danych.
  // W zwykłym Chromium nie ma sesji Electron. Testujemy modal na aktywnym czacie.
  await page.addInitScript(() => {
    const conversation = {
      id: '00000000-0000-4000-8000-0000000016a0',
      title: 'Rozmowa testowa',
      createdAt: '2026-11-10T12:00:00Z',
      updatedAt: '2026-11-10T12:00:00Z',
    };
    (window as any).jarvisDesktop = {
      ...((window as any).jarvisDesktop ?? {}),
      chatApi: async (request: { operation: string }) => {
        switch (request.operation) {
          case 'list':
            return { ok: true, status: 200, data: [conversation] };
          case 'messages':
            return { ok: true, status: 200, data: [] };
          case 'create':
            return { ok: true, status: 201, data: conversation };
          case 'delete':
            return { ok: true, status: 204, data: null };
          default:
            return { ok: false, status: 400, error: 'UNSUPPORTED_TEST_OPERATION' };
        }
      },
    };
  });
  await page.goto('/');

  // JARVIS_16A_DELETE_CHAT_PREP_V1 — najpierw aktywna rozmowa, potem dialog
  const jarvisAuditDeleteButton = page.getByRole('button', { name: 'Usuń czat' });
  if (!(await jarvisAuditDeleteButton.isEnabled())) {
    const newConversation = page.locator('.chat-history__new');
    await expect(newConversation).toBeVisible();
    await newConversation.click();
  }
  await expect(jarvisAuditDeleteButton).toBeEnabled();
  await page
    .getByRole('button', {
      name: 'Usuń czat',
    })
    .click();

  const dialog = page.getByRole('alertdialog', {
    name: 'Usunąć rozmowę?',
  });

  await expect(dialog).toBeVisible();

  await expect(
    dialog.getByText('Tej operacji nie można cofnąć.', {
      exact: false,
    }),
  ).toBeVisible();

  await dialog
    .getByRole('button', {
      name: 'Anuluj',
    })
    .click();

  await expect(dialog).not.toBeVisible();
});
