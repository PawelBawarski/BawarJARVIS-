# Naprawy 17.6.10 — 2026-11-11

## Wynik

Kod, regresje i pakowanie poprawione. Nowy NSIS zbudowany i statycznie zweryfikowany. W izolowanym teście Windows potwierdzono prawdziwe PostgreSQL 17.11, ACL/SCRAM, Flyway V1–V5, chronione REST i rozmowę zachowaną po restarcie Javy. Dane istniejącego profilu nie były zmieniane; jego częściowy klaster wymaga kontrolowanego odzyskania stanu.

Szczegółowe wyniki i polecenia: `docs/CURRENT_STATUS.md`. Zmiany pozostają w working tree; bez commita, push, instalacji i publikacji.

Poglądowy diff: `dist/jarvis-17-5/maintenance-17-6-10.review.diff`. Obejmuje aktualny working tree względem HEAD, również zmiany zastane przed sesją i pliki wcześniej nieśledzone. Linie dotyczące poświadczeń są zredagowane; ten plik służy do przeglądu, nie do `git apply`.

## Zmienione i dodane pliki

| Zakres | Pełne ścieżki względem repo |
| --- | --- |
| Kontroler PG i dowód własności procesu | `desktop/electron/postgres-process.cjs`, `desktop/electron/postgres-process.test.cjs` |
| Bootstrap, ACL, odzyskiwalne poświadczenia i legacy | `desktop/electron/postgres-first-run.cjs`, `desktop/electron/postgres-first-run.test.cjs` |
| PG lifecycle i ścieżki | `desktop/electron/postgres-runtime.cjs`, `desktop/electron/postgres-runtime.test.cjs`, `desktop/electron/postgres-data-path.test.cjs` |
| Backend i zamykanie Javy | `desktop/electron/backend-runtime.cjs`, `desktop/electron/backend-runtime.test.cjs` |
| Qwen i anulowanie przygotowania | `desktop/electron/qwen-runtime.cjs`, `desktop/electron/qwen-runtime.test.cjs` |
| Kolejność uruchamiania i zamykania | `desktop/electron/main.cjs`, `desktop/electron/runtime-lifecycle.cjs`, `desktop/electron/runtime-lifecycle.test.cjs` |
| Narzędzie administracyjne PG | `tools/desktop17/postgres17_windows.py`, `tools/desktop17/test_postgres17_windows.py` |
| Licencje | `scripts/stage-llm-licenses.cjs`, `desktop/electron/release-licenses.test.cjs` |
| Kontrola artefaktu i manifest | `scripts/verify-release-artifact.cjs`, `scripts/verify-release-artifact.test.cjs` |
| Builder | `electron-builder.stage17-5.config.cjs`, `tools/desktop17/test_builder_config_17_5.cjs`, `desktop/package.json` |
| Packager Python | `tools/desktop17/package_windows_17_5.py`, `tools/desktop17/test_package_windows_17_5.py` |
| Natywne testy opt-in | `scripts/postgres-native-smoke.cjs`, `scripts/postgres-native-smoke.test.cjs`, `scripts/backend-native-smoke.cjs`, `scripts/backend-native-smoke.test.cjs` |
| Wykluczenie backupów z JAR | `backend/pom.xml` |
| Testy UI i poprawka fixture treningu | `frontend/e2e/module-navigation-17-1.e2e.spec.ts`, `frontend/e2e/ai-lab-training.e2e.spec.ts`, `frontend/src/app/layout/app-shell/app-shell.spec.ts` |
| CI | `.github/workflows/frontend-tests.yml`, `.github/workflows/windows-installer.yml` |
| Porządki i dokumentacja | `.gitignore`, `docs/CURRENT_STATUS.md`, `docs/PROJECT_CONTEXT.md`, `docs/START_IN_CODEX.md`, `docs/MAINTENANCE_17_6_10.md` |

## Artefakt

`dist/jarvis-17-5/J.A.R.V.I.S.-Setup-1.0.3-x64.exe`, 663858522 B.

SHA-256: `1a2bad29c9650c4e5e1a0c307b9d35fec3c0db9c8e41958110b60402a1320b53`.

Manifest `dist/jarvis-17-5/stage17-5-build.json` pozostawia `github_release_upload_ready=false`. To nie jest zatwierdzenie publicznego wydania ani test aktualizacji do wyższej wersji. Nazwa, appId, lokalizacja modelu i retencja danych pozostały zachowane.

## Porządki i przywrócenie

Automatyczna kontrola odrzuciła trwałe usunięcie czterech odtwarzalnych katalogów: podała `blocked by policy`. Bez obchodzenia tego ograniczenia przeniesiono je odwracalnie, po sprawdzeniu bezwzględnych ścieżek i braku dowiązań:

- `frontend/.angular`
- `frontend/test-results`
- `tools/desktop17/__pycache__`
- `desktop/.jarvis-build`

Łącznie 33783322 B, w `C:/Users/bawar/AppData/Local/Temp/JarvisCleanup-2bbd59af2ebd4d77b33014a5fc14c1e1`. Plik `restore-map.json` zawiera dokładne lokalizacje. Przywracać wyłącznie do nieistniejącej ścieżki źródłowej; regeneracja cache może już utworzyć nowy katalog, którego nie wolno nadpisywać w ciemno.

Zachowano unikalne backupy źródeł, dawne instalatory oraz archiwum `.jarvis-stage17-2-backups.zip` (6437965661 B). Archiwum zawiera model i pliki konfiguracji; nie należy go dodawać do Git, instalatora ani udostępniać bez przeglądu. Nie czytano ani nie ujawniano wartości poświadczeń. Nowy staging Java/JAR zachował poprzedni staging w `desktop/resources/.stage17-2-backups/20261111T212149Z`.

Starsze usunięcia dokumentacji oraz plików w Git zastano przed pracą. Jedyna nowa usunięta ścieżka śledzona wynikająca z porządków to przeniesiony, generowany `frontend/test-results/.last-run.json`. Nie przywracano wcześniejszych usunięć.

## Plan odzyskania istniejącego profilu — wymaga osobnej zgody

Istniejący PostgreSQL PID 32588 obsługuje `%APPDATA%/JarvisData/postgres17/data` na `127.0.0.1:55432`. Brakuje utrwalonej konfiguracji i poświadczeń. Nie wiadomo, czy baza zawiera wcześniejszą historię. Sam instalator nie rozwiąże tego stanu.

Przed ingerencją ponownie ustalić PID, katalog, port, działanie aplikacji i stan plików. Nie opierać się wyłącznie na PID zapisanym w tym raporcie.

Po świadomej zgodzie właściciela proponowana procedura obejmuje:

1. Kontrolowane zatrzymanie dokładnie wskazanego klastra przez zaufany `pg_ctl -D ... -m fast -w stop`, z potwierdzeniem zakończenia. Bez zabijania obcych procesów po porcie.
2. Kompletną prywatną kopię offline `JarvisData` w nowym katalogu kopii z ACL właściciela, kontrolą zakresu ścieżek, dowiązań i zgodności kopii. Bez ZIP i bez usuwania oryginału.
3. Ustalenie dostępności lokalnych poświadczeń bez ich logowania. Jeżeli ich nie ma, osobno objęte zgodą odzyskanie dostępu do roli lokalnej; bez poluzowania ACL lub `pg_hba.conf`.
4. Sprawdzenie faktycznej zawartości baz i schematów. Zachować całą historię. Nie tworzyć fałszywego `state.json`, nie oznaczać niezweryfikowanych danych jako świeżych ani zmigrowanych.
5. Dopiero po walidacji odtworzyć spójną prywatną konfigurację, zainstalować nowy EXE i wykonać testy aplikacji. Przy nieznanym stanie zatrzymać procedurę i przedstawić wynik zamiast zgadywać.

Przed zakończeniem tej procedury etap pierwszego uruchomienia profilu właściciela pozostaje otwarty. Ręczna checklista, podpis, aktualizacja/rollback oraz niezależny przegląd nadal warunkują pełny Release Gate.
