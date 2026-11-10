# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: module-navigation-17-1.e2e.spec.ts >> the application exposes only the four retained modules
- Location: e2e\module-navigation-17-1.e2e.spec.ts:3:1

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 0

  Set {
    "chat",
    "lab",
-   "radio",
    "security",
  }
```

# Page snapshot

```yaml
- generic [ref=e4]:
  - complementary [ref=e7]:
    - generic [ref=e8]:
      - generic [aria-hidden] [ref=e9]: J
      - generic [ref=e10]:
        - strong [ref=e11]: J.A.R.V.I.S.
        - generic [ref=e12]: OSOBISTY ASYSTENT AI
    - navigation "MENU" [ref=e13]:
      - paragraph [ref=e14]: MENU
      - generic [ref=e15]:
        - generic [aria-hidden] [ref=e16]: ✦
        - generic [ref=e17]: Asystent AI
      - generic [ref=e20]:
        - heading "Historia rozmów" [level=2] [ref=e21]
        - button "Nowy czat" [ref=e22] [cursor=pointer]:
          - generic [aria-hidden] [ref=e23]: +
    - generic [ref=e24]:
      - status "Internet niezweryfikowany — kliknij, aby sprawdzić" [ref=e27]:
        - generic [aria-hidden] [ref=e32]: "?"
      - generic [ref=e33]: JARVIS Desktop v0.1
  - generic [ref=e35]:
    - banner [ref=e36]:
      - button "Zamknij menu" [expanded] [ref=e37] [cursor=pointer]:
        - generic [aria-hidden] [ref=e38]: ✕
      - navigation "Moduły Jarvisa" [ref=e40]:
        - button "Poprzedni moduł" [ref=e41] [cursor=pointer]:
          - generic [aria-hidden] [ref=e42]: ‹
        - generic [ref=e43]: Wybierz moduł
        - combobox "Wybierz moduł" [ref=e44]:
          - option "Czat" [selected]
          - option "AI Lab"
          - option "Bezpieczeństwo"
        - button "Następny moduł" [ref=e45] [cursor=pointer]:
          - generic [aria-hidden] [ref=e46]: ›
      - generic [ref=e47]:
        - button "Otwórz radio" [ref=e50] [cursor=pointer]:
          - generic [aria-hidden] [ref=e51]: 📻
        - button "Jak działa ten moduł?" [ref=e52] [cursor=pointer]:
          - generic [aria-hidden] [ref=e53]: "?"
        - button "Otwórz ustawienia" [ref=e54] [cursor=pointer]:
          - generic [aria-hidden] [ref=e55]: ⚙
    - main [ref=e56]:
      - generic [ref=e60]:
        - generic [ref=e61]:
          - generic [ref=e62]:
            - paragraph [ref=e63]: JARVIS / ASSISTANT
            - heading "Centrum dowodzenia" [level=1] [ref=e64]
            - paragraph [ref=e65]: Nowy czat
          - generic [ref=e66]:
            - button "Nowy czat" [ref=e67] [cursor=pointer]:
              - generic [aria-hidden] [ref=e68]: +
            - button "Usuń czat" [disabled] [ref=e69] [cursor=pointer]:
              - generic [aria-hidden] [ref=e70]: 🗑
        - main [ref=e71]:
          - generic [ref=e72]:
            - generic [ref=e73]: J
            - heading "J.A.R.V.I.S." [level=2] [ref=e74]
            - paragraph [ref=e75]: Twój osobisty asystent AI
        - generic [ref=e76]:
          - generic [ref=e77]:
            - textbox "Napisz wiadomość do Jarvisa..." [ref=e78]
            - button "Wyślij" [disabled] [ref=e79]
          - status [ref=e80]: Backend jest niedostępny. Uruchom Spring Boot i Electron.
          - alert [ref=e81]: Backend jest niedostępny. Uruchom Spring Boot i Electron.
          - paragraph [ref=e82]: "Silnik rozmowy: lokalny Qwen3 8B"
```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test';
  2  | 
  3  | test('the application exposes only the four retained modules', async ({ page }) => {
  4  |   await page.goto('/');
  5  |   const menu = page.locator('select').filter({ has: page.locator('option[value="chat"]') }).first();
  6  |   await expect(menu).toBeVisible();
  7  |   const ids = await menu.locator('option').evaluateAll(options =>
  8  |     options.map(option => (option as HTMLOptionElement).value).filter(Boolean),
  9  |   );
> 10 |   expect(new Set(ids)).toEqual(new Set(['chat', 'lab', 'radio', 'security']));
     |                        ^ Error: expect(received).toEqual(expected) // deep equality
  11 |   await menu.selectOption('radio');
  12 |   await expect(menu).toHaveValue('radio');
  13 |   await menu.selectOption('security');
  14 |   await expect(menu).toHaveValue('security');
  15 |   await menu.selectOption('chat');
  16 |   await expect(page.getByTestId('chat-messages')).toBeVisible();
  17 | });
  18 | 
```