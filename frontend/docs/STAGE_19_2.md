# J.A.R.V.I.S. 19.2 — weryfikacja jednego pliku w odizolowanym kontenerze

## Zakres

Etap 19.2 jest **opcjonalny i domyślnie wyłączony**. Nie zmienia uprawnień zapisu z 19.1.
Użytkownik naciska osobny przycisk w AI Lab. Backend uruchamia tymczasowy kontener
Docker bez sieci i bez montowania repozytorium. Do kontenera przekazywany jest
wyłącznie proponowany kod przez stdin. Kontrola nie czyta plików projektu, nie
zmienia ich i nie zapisuje nowej wersji.

Wynik odnosi się do aktualnej propozycji: `relativePath`, `original`, `proposed`
i `proposedSha256`. Po zmianie podglądu poprzedni wynik znika.

## Wymagania i konfiguracja Windows

1. Zainstaluj i uruchom Docker Desktop **w trybie kontenerów Linux**.
2. Świadomie pobierz oficjalne obrazy do lokalnego magazynu Docker:

   ```bash
   docker pull node:22-alpine
   docker pull eclipse-temurin:21-jdk-alpine
   docker image inspect node:22-alpine
   docker image inspect eclipse-temurin:21-jdk-alpine
   ```

   Wersje są zależne od tych tagów; w środowisku o podwyższonych wymaganiach
   bezpieczeństwa należy przypiąć obrazy po zatwierdzonym digest i przeprowadzić
   ich kontrolę przed użyciem.

3. Zainstaluj brakujące klucze PL/EN bez nadpisywania słowników:

   ```bash
   cd ~/Desktop/Nauka/BawarJARVIS-/frontend
   node scripts/install-stage19-2.cjs
   npm run check:i18n
   ```

4. W `BawarJARVIS-/backend/.env.jarvis` dodaj:

   ```ini
   JARVIS_AGENT_TESTS_ENABLED=true
   ```

5. Zrestartuj backend wraz z Angular:

   ```bash
   cd ~/Desktop/Nauka/BawarJARVIS-/frontend
   npm run dev:web:ai
   ```

   `frontend/scripts/dev-stack.cjs` odczytuje teraz tę zmienną z `.env.jarvis`.
   Samo `npm run build` nie uruchamia testów Docker.

6. W AI Lab przygotuj diff, a następnie użyj panelu **Weryfikacja w izolacji**.
   Bez kliknięcia `Uruchom weryfikację` backend nie uruchamia kontenera.

## Obsługiwane kontrole

| Plik | Co dokładnie sprawdzamy | Czego NIE sprawdzamy |
|---|---|---|
| `.ts` | Parsowanie składni przez Node.js `module.stripTypeScriptTypes()` | TypeScript type checking, Angular, `.tsx`, decorators oparte na projekcie |
| `.js`, `.cjs` | `node --check`, bez wykonywania kodu | Testy biznesowe, zależności aplikacji |
| `.test.js`, `.spec.js`, `.test.cjs`, `.spec.cjs` | `node --test` wewnątrz kontenera | Testy całego projektu, brak dostępu do NPM dependencies |
| `.java` | `javac -proc:none` dla samodzielnego pliku | Spring Boot, Maven, zależności i klasy z repozytorium |

Pozostałe formaty (np. HTML, SCSS, JSON, TSX) zwracają `UNSUPPORTED_TEST_FILE`.
Kontrola `PASS` nie jest gwarancją poprawności, bezpieczeństwa ani przejścia
całego projektu. Nie zatwierdza również zapisu automatycznie. Zapis nadal wymaga
obu potwierdzeń z etapu 19.1.

## Zabezpieczenia Docker

- `--network none`, `--read-only`, `--cap-drop ALL`, `--security-opt no-new-privileges`.
- UID/GID 65534, limity CPU, pamięci (384 MiB), procesów (64) i czasu (20 s).
- Tylko ograniczony katalog tymczasowy `tmpfs`; **bez** bind mountów, repozytorium,
  `.env` i portów hosta.
- Kod przesyłany przez stdin (nie jest argumentem `sh -c`).
- `--pull=never`: uruchomienie nie pobiera automatycznie obrazów z internetu.
- Maksymalnie jedna weryfikacja na proces Spring Boot, maksymalnie 16 KiB nowego kodu
  i 12 KiB tekstu wynikowego.
- Nie uruchamiaj takiego runnera na nieufanym wieloużytkownikowym serwerze ani
  w środowisku produkcyjnym; kontenery Docker ograniczają ryzyko, ale nie stanowią
  absolutnej bariery dla złośliwego kodu.

## Testy projektu

```bash
cd ~/Desktop/Nauka/BawarJARVIS-/backend
./mvnw.cmd -Dtest=AgentIsolatedCheckServiceTest test

cd ../frontend
node --test scripts/install-stage19-2.test.cjs
npm run check:i18n
npm test -- --watch=false
npm run build
npx playwright test e2e/agent-isolated-check-19-2.e2e.spec.ts e2e/agent-controlled-file-19-1.e2e.spec.ts
```

Testy Playwright mockują odpowiedzi runnera — nie wykonują nieznanego kodu w CI.
Własny test w Dockerze wykonuj ręcznie na małym pliku testowym przy uruchomionym
Docker Desktop. Brak `docker` / brak pobranego obrazu daje `unavailable`, a nie
fałszywe `passed`.

## Nowe pliki względem BawarJARVIS-

- `backend/src/main/java/pl/bawar/jarvis/agent/AgentIsolatedCheckService.java`
- `backend/src/main/java/pl/bawar/jarvis/agent/AgentIsolatedCheckController.java`
- `backend/src/main/java/pl/bawar/jarvis/agent/AgentIsolatedCheckErrorHandler.java`
- `backend/src/test/java/pl/bawar/jarvis/agent/AgentIsolatedCheckServiceTest.java`
- `frontend/src/app/core/services/agent-isolated-check-api.ts`
- `frontend/src/app/features/ai-lab/agent-isolated-check/agent-isolated-check.ts`
- `frontend/src/app/features/ai-lab/agent-isolated-check/agent-isolated-check.html`
- `frontend/src/app/features/ai-lab/agent-isolated-check/agent-isolated-check.scss`
- `frontend/src/app/features/ai-lab/agent-isolated-check/agent-isolated-check.spec.ts`
- `frontend/e2e/agent-isolated-check-19-2.e2e.spec.ts`
- `frontend/docs/STAGE_19_2.md`
- `frontend/scripts/install-stage19-2.cjs`
- `frontend/scripts/install-stage19-2.test.cjs`

Zmieniane istniejące pliki: `frontend/scripts/dev-stack.cjs`,
`frontend/src/app/features/ai-lab/agent-file-write/agent-file-write.ts`,
`frontend/src/app/features/ai-lab/agent-file-write/agent-file-write.html`,
`frontend/src/app/features/ai-lab/agent-file-write/agent-file-write.spec.ts`,
`frontend/public/i18n/pl.json`, `frontend/public/i18n/en.json` (tylko poprzez idempotentny instalator, nie przez patch).
