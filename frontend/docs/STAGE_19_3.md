# J.A.R.V.I.S. 19.3 — testowanie zestawu powiązanych plików

## Co dokładnie działa

Po wygenerowaniu diffu w AI Lab rozwiń **Test powiązanych plików (Docker)**. Możesz
wybrać maksymalnie **8 dodatkowych plików z tego samego katalogu** co plik proponowany
przez Qwen. Tylko te pliki są wysyłane do Spring Boot. Serwer dodaje do nich proponowaną
wersję pliku i buduje mały, jednorazowy ZIP przekazywany przez stdin do Dockera.

- JS/CJS: jeżeli wybierzesz plik `*.test.js`, `*.spec.js`, `*.test.cjs` lub `*.spec.cjs`,
  możesz go uruchomić przez `node --test`. W przeciwnym wypadku sprawdzana jest składnia.
- Java: `javac -proc:none` kompiluje wszystkie przesłane klasy Java razem.
- TypeScript: parser sprawdza tylko składnię wybranych plików. Nie jest to `tsc` ani `ng test`.

**UWAGA:** kontrola Java bez Springowych zależności i TypeScript bez frameworka
nie zastępują testów całego modułu Angular/Spring. Uruchamianie `npm test` lub `mvn test`
w odizolowanym obrazie z przypiętymi zależnościami jest osobnym, późniejszym etapem.

## Ochrona danych i zasobów

- Tryb domyślnie wyłączony przez `JARVIS_AGENT_TESTS_ENABLED=false`.
- Po stronie Spring obowiązuje uprawnienie `ROLE_JARVIS`.
- Kod i testy są uruchamiane wyłącznie po kliknięciu przycisku.
- Serwer **nie czyta dysku projektu, nie montuje repozytorium i nie zapisuje zmienionych plików**.
- Pliki wejściowe: najwyżej 1 + 8, do 32 KiB na plik, do 128 KiB łącznie.
- Brak sieci, brak Linux capabilities, read-only filesystem, osobny tmpfs, limity
  procesów (64), pamięci (384 MiB), CPU (1) i czasu (30 s).
- `--pull=never` oznacza, że obrazy muszą istnieć lokalnie.
- Wynik przypisany do skrótu SHA-256 **propozycji** i **całego przesłanego zestawu**.
- Wynik `PASS` NIE autoryzuje żadnego zapisu. Zapis nadal wymaga osobnych zezwoleń 19.1.
- Docker nie jest absolutną barierą przed nieufnym kodem. Nie włączaj tej funkcji
  w publicznie dostępnym środowisku lub na maszynach z wrażliwymi danymi.

## Konfiguracja

W `BawarJARVIS-/backend/.env.jarvis`:

```ini
JARVIS_AGENT_TESTS_ENABLED=true
```

Wymaga Linux Docker Desktop i wcześniej pobranych obrazów:

```bash
docker pull node:22-alpine
docker pull eclipse-temurin:21-jdk-alpine
```

Zaleca się przypięcie obrazów po digest po ich weryfikacji.

## Instalacja

```bash
cd ~/Desktop/Nauka/BawarJARVIS-
git apply --check ~/Downloads/JARVIS_STAGE_19_3_MODULE_CHECKS.patch && \
git apply ~/Downloads/JARVIS_STAGE_19_3_MODULE_CHECKS.patch
cd frontend
node scripts/install-stage19-3.cjs
```

Instalator tworzy kopie istniejących plików `.backup-before-stage-19-3` i nie
zastępuje wcześniejszych tekstów tłumaczeń. Jest idempotentny.

## Testy

```bash
cd ~/Desktop/Nauka/BawarJARVIS-/frontend
node --test scripts/install-stage19-3.test.cjs
npm run check:i18n
npm test -- --watch=false
npm run build
npx playwright test e2e/agent-module-check-19-3.e2e.spec.ts \
  e2e/agent-isolated-check-19-2.e2e.spec.ts

cd ../backend
./mvnw.cmd -Dtest=AgentModuleCheckServiceTest,AgentIsolatedCheckServiceTest test
```

Jeżeli masz włączone uruchamianie przez `npm run dev:web:ai`, zrestartuj backend
po wdrożeniu nowych klas. Nie są konieczne nowe migracje bazy danych.

## Nowe pliki (ścieżki względem BawarJARVIS-)

- `backend/src/main/java/pl/bawar/jarvis/agent/AgentModuleCheckService.java`
- `backend/src/main/java/pl/bawar/jarvis/agent/AgentModuleCheckController.java`
- `backend/src/main/java/pl/bawar/jarvis/agent/AgentModuleCheckErrorHandler.java`
- `backend/src/test/java/pl/bawar/jarvis/agent/AgentModuleCheckServiceTest.java`
- `frontend/src/app/core/services/agent-module-check-api.ts`
- `frontend/src/app/features/ai-lab/agent-module-check/agent-module-check.ts`
- `frontend/src/app/features/ai-lab/agent-module-check/agent-module-check.html`
- `frontend/src/app/features/ai-lab/agent-module-check/agent-module-check.scss`
- `frontend/src/app/features/ai-lab/agent-module-check/agent-module-check.spec.ts`
- `frontend/e2e/agent-module-check-19-3.e2e.spec.ts`
- `frontend/scripts/install-stage19-3.cjs`
- `frontend/scripts/install-stage19-3.test.cjs`
- `frontend/docs/STAGE_19_3.md`

Instalator aktualizuje istniejące pliki:
`frontend/src/app/features/ai-lab/agent-isolated-check/agent-isolated-check.ts`,
`frontend/src/app/features/ai-lab/agent-isolated-check/agent-isolated-check.html`,
`frontend/public/i18n/pl.json`, `frontend/public/i18n/en.json`.
