# J.A.R.V.I.S. AI Lab — V1 release checklist (19.5)

## Gotowe w pierwszej wersji

- Ręczny wybór i zatwierdzenie fragmentu kodu, lokalny model Qwen, plan i diff.
- Ostrzeżenia heurystyczne dla propozycji; nie stanowią audytu bezpieczeństwa.
- Wybór projektu i sprawdzenie źródeł / modułu w Dockerze, bez nadpisywania repozytorium.
- Opcjonalny zapis całego, zweryfikowanego względem oryginału pliku, dwa potwierdzenia, kopia zapasowa i rollback.
- Trwała historia **testów kopii projektu 19.4** w PostgreSQL, tylko metadane, porównywanie dwóch prób.
- Wszystkie mutacje wymagają interakcji użytkownika; brak automatycznego zatwierdzania i zapisu.

## Czego V1 jeszcze nie robi

- Nie uruchamia autonomicznych cykli AI ani wieloetapowych planów bez nadzoru.
- Nie zapewnia formalnej izolacji wrogiego kodu (Docker nie zastępuje VM).
- Nie stosuje automatycznie kolejnych poprawek po błędach testów.
- Nie wymusza wyniku PASS jako warunku zapisu — decyzja pozostaje u użytkownika.
- Nie przechowuje szczegółowych logów w historii; są dostępne tylko po aktualnym teście.
- Historia nie obejmuje runnerów 19.2/19.3, tylko pełne testy kopii projektu 19.4.

## Smoke test

1. `cd backend && ./mvnw.cmd -Dtest=AgentProjectCheckServiceTest,AgentProjectCheckHistoryRepositoryTest test`
2. `cd frontend && node --test scripts/install-stage19-5.test.cjs`
3. `npm run check:i18n && npm test -- --watch=false && npm run build`
4. `npx playwright test e2e/agent-project-check-history-19-5.e2e.spec.ts e2e/agent-project-check-19-4.e2e.spec.ts`
5. `npm run dev:web:ai`; wykonaj test kopii (19.4), wybierz **Pobierz historię testów**, porównaj dwie próby.
6. Potwierdź, że w historii nie widać kodu, logów, tokenów, haseł ani ścieżek bezwzględnych.

## Bezpieczeństwo

- `JARVIS_AGENT_TESTS_ENABLED=false` domyślnie; przygotowanie obrazu zależności tylko jawnie.
- `JARVIS_AGENT_FILE_WRITES_ENABLED=false` domyślnie; ustawiaj workspace testowy, nie całe repo do pierwszych prób.
- Nie przesyłaj do runnera sekretów, plików `.env` ani poufnej konfiguracji.
- Nowa migracja Flyway: `backend/src/main/resources/db/migration/V6__agent_project_check_history.sql`.
- Wynik zapisuje backend po wykonaniu testu. Endpoint historii nie pozwala dopisać własnego wyniku.
- Odmowa modyfikacji pliku i rollback po zmianie poza J.A.R.V.I.S. są testowane osobno w 19.1.
