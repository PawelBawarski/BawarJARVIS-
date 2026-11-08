# J.A.R.V.I.S. 9.5.3 — instalacja plików

Paczka zawiera pliki z docelowymi ścieżkami od katalogu `BawarJARVIS-/`.

## Ważne
- `SecurityHealthController.java`: kopiuj tylko, jeśli nie masz już kontrolera dla `/api/security/health`.
- `ApiSecurityConfig.java`: zastępuje wersję z Klocka 9.5.2. Jeśli zmieniałeś reguły samodzielnie, porównaj pliki i nie usuwaj swoich zabezpieczeń.
- Pozostałe nowe pliki skopiuj zgodnie ze ścieżkami w archiwum.
- W trzech istniejących plikach (`desktop/electron/main.cjs`, `desktop/electron/window-options.cjs`, `frontend/src/app/core/services/security-diagnostics.ts`) trzeba wprowadzić zmiany pokazane w odpowiedzi ChatGPT — paczka celowo NIE nadpisuje tych plików.
- Dodaj tłumaczenie `security.authenticated` w PL/EN i nowy przypadek w `security-dashboard.html`.

## Testy
Backend: `cd backend && ./mvnw.cmd clean test`
Desktop: `cd desktop && npm test`
Frontend: `cd frontend && npm test -- --watch=false && npm run build && npx playwright test`

## Uruchomienie developerskie
W jednej sesji Git Bash wygeneruj losowy token:
`export JARVIS_SESSION_TOKEN="$(node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))")"`
Następnie z **tej samej sesji** uruchom backend (`./mvnw.cmd spring-boot:run`) i Electron (np. backend w tle `&`, następnie `npm run preview` w desktop). Oba procesy muszą odziedziczyć TEN SAM sekret z environment.

Nie umieszczaj tokenu w `application.properties`, frontendzie, repozytorium ani plikach `.env` objętych Git.

To konfiguracja rozwojowa. Dystrybucja produkcyjna wymaga zarządzania cyklem życia backendu, rotacji tokenu i testów IPC w prawdziwym Electronie.
