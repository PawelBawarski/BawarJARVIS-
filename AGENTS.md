# J.A.R.V.I.S. — instrukcje dla agenta programistycznego

## Repozytorium i cel
- Repozytorium: `PawelBawarski/BawarJARVIS-`.
- Projekt: desktopowy asystent J.A.R.V.I.S. na Windows, budowany etapami.
- Stos: Angular (TypeScript, SCSS, standalone components, Signals), Java 21 + Spring Boot, Electron, testy Node.js, Angular/Vitest, Playwright oraz backendowe.
- Komunikacja z użytkownikiem po polsku; interfejs J.A.R.V.I.S. domyślnie PL z opcją EN.
- Projekt docelowo ma lokalny silnik LLM w Javie (nie zakładaj korzystania z pobranego gotowego modelu).

## Zasady pracy
- Zanim edytujesz plik, przeczytaj jego aktualną zawartość. Nie zakładaj, że opis poniżej dokładnie odpowiada bieżącemu stanowi branchu.
- Przy każdej zmianie podawaj pełną ścieżkę względem katalogu `BawarJARVIS-`, np. `desktop/electron/workspace-access.cjs`.
- Preferuj małe, możliwe do sprawdzenia kroki; nie zmieniaj niepowiązanych modułów i nie przygotowuj gotowych ZIP-ów.
- Komponenty Angular mają zachowywać strukturę oddzielnych plików TypeScript, HTML, SCSS i testu `.spec.ts` (jeśli to dotyczy aktualnej struktury komponentu).
- Każde nowe zadanie frontendowe obejmuje również dodanie lub aktualizację testów E2E w Playwright, a odpowiednie testy jednostkowe należy dostosować.
- Zachowaj obecny wygląd i zachowanie czatu, sidebara oraz pozostałych modułów, chyba że użytkownik wyraźnie zleca zmianę.
- Dla usuwania konwersacji używaj własnego modala Angular; nie zastępuj go `window.confirm`.
- Nie umieszczaj kluczy API, tokenów, haseł ani zawartości `.env` w odpowiedziach, commitach lub logach.
- Przed potencjalnie destrukcyjnymi operacjami (nadpisywanie większej liczby plików, usunięcia, push, release) uzyskaj świadomą zgodę użytkownika. Zawsze pokaż diff i weryfikację.

## Bezpieczeństwo i dostępy
- Prawdziwe mechanizmy bezpieczeństwa muszą działać w Electron/Java Spring Boot, a nie tylko w dashboardzie Angular.
- AI Lab Workspace w etapie 12.4 udostępnia wyłącznie odczyt katalogu wybranego natywnym selektorem. Nie rozszerzaj możliwości zapisu, uruchamiania komend ani dostępu do systemu bez osobnego etapu i zatwierdzenia.
- Zachowaj ochronę przed path traversal, symlink escape, odczytem sekretów, zbyt dużymi i binarnymi plikami, przypadkowym wyborem katalogu domowego lub głównego woluminu.
- Dla kanałów IPC obowiązuje allowlist i walidacja zaufanego nadawcy. Nie usuwaj ograniczeń bezpieczeństwa wyłącznie w celu zaliczenia testu.

## Aktualny etap — AI Lab 12.4
- Stan według logów użytkownika z 2026-11-09:
  - Angular: 97/97 testów jednostkowych zaliczonych; `npm run build` zaliczony.
  - Playwright: `frontend/e2e/ai-lab-workspace.e2e.spec.ts` — 1/1 zaliczony.
  - Electron: `desktop/electron/workspace-access.test.cjs` — 3/9 zaliczonych, 6 błędów.
  - Błąd w testach Electrona: `WORKSPACE_FORBIDDEN` w `desktop/electron/workspace-access.cjs`, `validRoot()` podczas `WorkspaceAccess.select()`; jeden test IPC ma porównanie `false !== true`, prawdopodobnie wtórne.
- Istnieje propozycja naprawy tymczasowych katalogów testowych (`napraw_jarvis_workspace_tests_12_4.py`), ale NIE MA POTWIERDZENIA, że uruchomiono ją skutecznie w repozytorium.
- Pierwszym zadaniem jest sprawdzenie bieżącego `workspace-access.cjs` i `workspace-access.test.cjs`, ustalenie przyczyny oraz doprowadzenie do 9/9 testów bez osłabiania zabezpieczeń.
- Polecenie kontrolne z katalogu głównego: `node --test desktop/electron/workspace-access.test.cjs`.
- Polecenia frontendowe z katalogu `frontend`: `npm test -- --watch=false`, `npm run build`, `npx playwright test e2e/ai-lab-workspace.e2e.spec.ts`.
- Nie raportuj testów jako zaliczonych, jeśli faktycznie ich nie uruchomiono.

## Planowany kolejny etap — AI Lab 12.5
- Dopiero po zamknięciu 12.4: użytkownik opisuje zadanie -> agent czyta dozwolony kod -> przygotowuje propozycję zmian/diff -> użytkownik zatwierdza -> kontrolowana edycja i testy w izolacji -> wynik i opcja ponowienia lub zakończenia.
- Bez automatycznego wykonywania nieznanych poleceń i bez autonomicznych modyfikacji bez zatwierdzenia.
- Każdy nowy ekran lub logika frontendowa ma odpowiednie testy jednostkowe i Playwright E2E.
