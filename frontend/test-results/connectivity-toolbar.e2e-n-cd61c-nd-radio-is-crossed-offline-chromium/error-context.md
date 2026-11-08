# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: connectivity-toolbar.e2e.spec.ts >> network and action icons render and radio is crossed offline
- Location: e2e\connectivity-toolbar.e2e.spec.ts:3:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('[data-testid="network-state"]')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('[data-testid="network-state"]') with timeout 5000ms
  - waiting for locator('[data-testid="network-state"]')

```

```yaml
- complementary:
  - text: J
  - strong: J.A.R.V.I.S.
  - text: OSOBISTY ASYSTENT AI
  - navigation "MENU":
    - paragraph: MENU
    - text: ✦ Asystent AI
    - heading "Historia rozmów" [level=2]
    - button "Nowy czat"
    - button "Nowy czat"
  - text: JARVIS Desktop v0.1
- banner:
  - button "Zamknij menu" [expanded]
  - navigation "Moduły Jarvisa":
    - button "Poprzedni moduł"
    - text: Wybierz moduł
    - combobox "Wybierz moduł":
      - option "Czat" [selected]
      - option "Kopanie"
      - option "AI Lab"
      - option "Bezpieczeństwo"
    - button "Następny moduł"
  - button "Otwórz radio"
  - button "Otwórz ustawienia"
- main:
  - paragraph: JARVIS / ASSISTANT
  - heading "Centrum dowodzenia" [level=1]
  - paragraph: Nowy czat
  - button "Nowy czat"
  - button "Usuń czat"
  - main:
    - text: J
    - heading "J.A.R.V.I.S." [level=2]
    - paragraph: Twój osobisty asystent AI
  - textbox "Napisz wiadomość do Jarvisa..."
  - button "Wyślij" [disabled]
  - status: Model AI nie jest jeszcze podłączony. Wiadomości są zapisywane lokalnie.
```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test';
  2  | 
  3  | test('network and action icons render and radio is crossed offline', async ({ page, context }) => {
  4  |   await page.goto('/');
> 5  |   await expect(page.locator('[data-testid="network-state"]')).toBeVisible();
     |                                                               ^ Error: expect(locator).toBeVisible() failed
  6  |   await expect(page.locator('[data-testid="install-link"]')).toBeVisible();
  7  |   await expect(page.locator('[data-testid="browser-link"]')).toBeVisible();
  8  | 
  9  |   await context.setOffline(true);
  10 |   await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  11 |   await expect(page.locator('[data-testid="install-link"]')).toBeDisabled();
  12 |   await expect(page.locator('[data-testid="browser-link"]')).toBeDisabled();
  13 |   await expect(page.locator('.radio-control__icon--offline')).toBeVisible();
  14 | });
  15 | 
```