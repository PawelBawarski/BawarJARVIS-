# J.A.R.V.I.S. — etap 16.2 — analiza wybranych plików projektu

## Funkcja

AI Lab → Propozycje ulepszeń → **Analiza kodu projektu**. Odczyt `workspace-access.cjs` zwiększa dozwoloną głębokość ścieżki z 6 do 12 katalogów (bez zmiany istniejących blokad).

1. Otwórz sekcję i kliknij „Wybierz katalog” (albo „Otwórz wybrany katalog”).
2. Wskaż folder projektu `BawarJARVIS-` w oknie systemowym.
3. Otwórz folder, następnie konkretny plik. Sprawdź podgląd.
4. Kliknij „Dodaj do kontekstu Qwen”. **Sam podgląd nie wysyła kodu**.
5. Wpisz zadanie i wybierz „Zaproponuj plan”. Qwen otrzyma tylko ręcznie zatwierdzone fragmenty.
6. Przejrzyj plan, popraw go lub zatwierdź. Akceptacja **nie zmienia kodu**.

Ograniczenia: maks. 3 fragmenty, 3600 znaków na plik, 8000 znaków łącznie. Tylko do odczytu. Panel używa obecnego Electron WorkspaceAccess (blokada symlinków, katalogów kompilacji i plików z nazwami wskazującymi na sekrety). *Nie zapewnia to rozpoznania każdego sekretu wpisanego wewnątrz zwykłego pliku kodu* — dlatego fragment trzeba przejrzeć przed zatwierdzeniem.

Wybrany kod przekazywany jest tylko do **lokalnego Spring Boot i Qwen**, nie jest osobno przechowywany w PostgreSQL; plan modelu jest zachowywany w dotychczasowej tabeli propozycji. Nie dodajemy migracji. Model nie wykonuje poleceń, zmian kodu ani testów.

## Instalacja — Git Bash, katalog główny

Pobierz `install_jarvis_16_2.py` do Downloads. Nie trzeba kopiować ZIP-a do repozytorium:

```bash
cd ~/Desktop/Nauka/BawarJARVIS-
python ~/Downloads/install_jarvis_16_2.py --check
python ~/Downloads/install_jarvis_16_2.py --apply
```

**Ważne**: przed instalacją zachowaj aktualny commit albo własną kopię projektu. Skrypt dodatkowo tworzy backup `.jarvis-stage16-2-backups/`. Instalacja nie dopuszcza nadpisania nieznanej wersji plików.

## Testy

```bash
cd ~/Desktop/Nauka/BawarJARVIS-
node --test desktop/electron/agent-proposal-ipc.test.cjs desktop/electron/workspace-access.test.cjs
cd backend
./mvnw.cmd test
cd ../frontend
npm run build
npm test -- --watch=false
npx playwright test e2e/ai-lab-code-context-16-2.e2e.spec.ts e2e/ai-lab-agent-proposals.e2e.spec.ts
```

Uruchomienie:

```bash
cd ~/Desktop/Nauka/BawarJARVIS-
python start_jarvis_ai.py
```

Rollback plików (tylko jeśli nie edytowano ich po instalacji):

```bash
cd ~/Desktop/Nauka/BawarJARVIS-
python ~/Downloads/install_jarvis_16_2.py --rollback
```

## Ścieżki docelowe względem BawarJARVIS-

- `backend/src/main/java/pl/bawar/jarvis/agent/AgentCodeSource.java`
- `backend/src/main/java/pl/bawar/jarvis/agent/AgentProposalController.java`
- `backend/src/main/java/pl/bawar/jarvis/agent/AgentProposalService.java`
- `backend/src/main/java/pl/bawar/jarvis/agent/AgentSourceContext.java`
- `backend/src/test/java/pl/bawar/jarvis/agent/AgentProposalServiceTest.java`
- `backend/src/test/java/pl/bawar/jarvis/agent/AgentSourceContextTest.java`
- `desktop/electron/agent-proposal-ipc.cjs`
- `desktop/electron/agent-proposal-ipc.test.cjs`
- `desktop/electron/workspace-access.cjs`
- `desktop/electron/workspace-access.test.cjs`
- `frontend/e2e/ai-lab-code-context-16-2.e2e.spec.ts`
- `frontend/src/app/core/services/agent-proposal-api.spec.ts`
- `frontend/src/app/core/services/agent-proposal-api.ts`
- `frontend/src/app/features/ai-lab/agent-planner/agent-planner.html`
- `frontend/src/app/features/ai-lab/agent-planner/agent-planner.scss`
- `frontend/src/app/features/ai-lab/agent-planner/agent-planner.spec.ts`
- `frontend/src/app/features/ai-lab/agent-planner/agent-planner.ts`


Nie modyfikujemy: chat-view, chat-history, stylów czatu, start_jarvis_ai.py, Docker, PostgreSQL ani żadnej migracji Flyway.

## Stan weryfikacji przed przekazaniem

- `node --test .../agent-proposal-ipc.test.cjs`: 8/8 PASS lokalnie w środowisku testowym.
- `node --test .../workspace-access.test.cjs`: 10/10 PASS lokalnie.
- `javac` dla AgentCodeSource + AgentSourceContext: PASS.
- Testy instalatora (check/apply/rollback/fail-closed): uruchomione w kopii repozytorium.
- Pełne `mvnw.cmd test`, `npm test`, `ng build` i Playwright: **do wykonania w Twojej lokalnej wersji projektu**. Nie deklarujemy zaliczenia bez wyników.
