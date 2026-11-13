# J.A.R.V.I.S. 19.4 — odizolowane testy kopii projektu Angular / Spring Boot

## Co działa

- Wybranie katalogu w przeglądarce, przycięcie do dozwolonych plików tekstowych i przesłanie snapshotu do lokalnego Spring Boot.
- Sprawdzenie zgodności **całego** oryginalnego pliku z podglądem Qwen. Propozycja trafia wyłącznie do pamięciowej kopii ZIP.
- Osobny, wcześniej przygotowany obraz Docker dla `ng test --watch=false` lub `mvn -o test`.
- Stałe polecenia wykonawcze, brak sieci i montowania repozytorium, limity zasobów oraz 180 s na test.
- Wynik związany z SHA-256 proponowanego kodu i kompletnego snapshotu; brak automatycznego zapisu i zatwierdzania.

## Istotne ograniczenia

1. **Wymaga ręcznego przygotowania obrazów.** `node scripts/prepare-stage19-4.cjs angular` oraz `... spring` pobierają zależności npm/Maven podczas jawnie uruchomionego buildu. Nie jest to automatyczne działanie backendu. Do kontekstu buildu trafiają wyłącznie manifesty (package.json + package-lock.json lub pom.xml).
2. Zależności z npm/Maven muszą być dostępne w obrazie. W razie zmiany manifestu obrazy należy przygotować ponownie. Tag obrazu jest powiązany ze skrótem manifestów.
3. Testy działają offline — testy wymagające internetu, zewnętrznej bazy danych lub usług sieciowych mogą zakończyć się niepowodzeniem. Dla Spring Boot jest to `mvn test`, a dla Angulara `ng test --watch=false` na przesłanych plikach. Nie są uruchamiane Playwright ani integracyjne testy z uruchomionym backendem.
4. Nie przekazujemy `node_modules`, `.m2`, plików `.env`, obrazków i plików binarnych. Dla rozbudowanego projektu niewysłane pliki i zasoby mogą powodować błędy kompilacji.
5. Maksymalnie 500 plików, 512 KiB na plik, 4 MiB łącznie, 180 sekund, 2 CPU, 2 GiB RAM. Duże projekty nie mieszczące się w limitach wymagają osobnej architektury.
6. Ograniczona izolacja kontenera **nie jest gwarancją bezpieczeństwa** dla arbitralnego wrogiego kodu. Dla kodu z niezaufanego źródła zalecana jest osobna maszyna/VM.
7. Pliki wybrane przez użytkownika przesyłane są do lokalnego serwera Spring Boot. Koniecznie przejrzyj źródła pod kątem sekretów, zwłaszcza pliki `.properties`, `.yml` i `.json`. Zależności obrazu podczas buildu mogą wykonywać skrypty instalacyjne.

## Instalacja

```bash
cd ~/Desktop/Nauka/BawarJARVIS-
git apply --check ~/Downloads/JARVIS_STAGE_19_4_PROJECT_TESTS.patch && \
git apply ~/Downloads/JARVIS_STAGE_19_4_PROJECT_TESTS.patch
cd frontend
node scripts/install-stage19-4.cjs
```

Włącz `JARVIS_AGENT_TESTS_ENABLED=true` w `backend/.env.jarvis` (jeżeli nie włączone) i uruchom Docker Desktop w trybie Linux.

Jawne przygotowanie obrazów zależności (przy włączonym internecie):

```bash
cd ~/Desktop/Nauka/BawarJARVIS-/frontend
node scripts/prepare-stage19-4.cjs angular
node scripts/prepare-stage19-4.cjs spring
```

Uruchom ponownie `npm run dev:web:ai`. W AI Lab wygeneruj propozycję diffu dla **całego pliku**, rozwiń „Test projektu z zależnościami (Docker)”, wybierz katalog `frontend` lub `backend`, kliknij „Uruchom testy kopii projektu”.

## Testy

```bash
cd ~/Desktop/Nauka/BawarJARVIS-/frontend
node --test scripts/install-stage19-4.test.cjs scripts/prepare-stage19-4.test.cjs
npm run check:i18n
npm test -- --watch=false
npm run build
npx playwright test e2e/agent-project-check-19-4.e2e.spec.ts

cd ../backend
./mvnw.cmd -Dtest=AgentProjectCheckServiceTest test
```

## Dokładne ścieżki nowych plików względem BawarJARVIS-

- `backend/src/main/java/pl/bawar/jarvis/agent/AgentProjectCheckService.java`
- `backend/src/main/java/pl/bawar/jarvis/agent/AgentProjectCheckController.java`
- `backend/src/main/java/pl/bawar/jarvis/agent/AgentProjectCheckErrorHandler.java`
- `backend/src/test/java/pl/bawar/jarvis/agent/AgentProjectCheckServiceTest.java`
- `frontend/src/app/core/services/agent-project-check-api.ts`
- `frontend/src/app/features/ai-lab/agent-project-check/agent-project-check.ts`
- `frontend/src/app/features/ai-lab/agent-project-check/agent-project-check.html`
- `frontend/src/app/features/ai-lab/agent-project-check/agent-project-check.scss`
- `frontend/src/app/features/ai-lab/agent-project-check/agent-project-check.spec.ts`
- `frontend/e2e/agent-project-check-19-4.e2e.spec.ts`
- `frontend/scripts/install-stage19-4.cjs`
- `frontend/scripts/install-stage19-4.test.cjs`
- `frontend/scripts/prepare-stage19-4.cjs`
- `frontend/scripts/prepare-stage19-4.test.cjs`
- `frontend/docs/STAGE_19_4.md`
