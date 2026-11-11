# J.A.R.V.I.S. — CURRENT STATUS / NEXT WORK

**Stan zweryfikowany: 2026-11-11, etap 17.6.10.** Źródłem prawdy są working tree, faktyczne wyniki testów i manifest artefaktu. Zmiany nie zostały zatwierdzone w Git, wypchnięte ani opublikowane.

## Wyniki wykonanych kontroli

| Kontrola | Wynik |
| --- | --- |
| Node: wszystkie testy desktop/electron, scripts i konfiguracji buildera | 257 łącznie: 252 PASS, 0 FAIL, 5 jawnych SKIP |
| Python: tools/desktop17/test_*.py | 37 łącznie: 36 PASS, 0 FAIL, 1 SKIP |
| Java 21 / Maven, offline, czysty test + package, H2 | 258 PASS, 0 FAIL, 0 SKIP |
| Angular / Vitest | 45 plików, 133 PASS |
| Angular build | PASS; istniejące WARN budżetu SCSS chat-view i agent-planner |
| Pełny Playwright / Chromium | 32 PASS |
| Natywny PostgreSQL 17.11, prywatny klaster tymczasowy | PASS: ACL, initdb/SCRAM, SQL, restart, trwałość, odrzucenie błędnego hasła, shutdown |
| Natywny PostgreSQL + dołączone Java 21 / Spring Boot | PASS: Flyway V1–V5, health 200/401, REST create/list, rozmowa zachowana po restarcie Javy |
| Nowy instalator NSIS i kontrola artefaktu | Zbudowany; post-build verifier PASS |
| Oryginalny pełny Release Gate 17.6.3 | BLOCKED — stara instalacja, ręczne scenariusze i podpis pozostają do zamknięcia |

SKIP-y dotyczą uprawnień Windows do tworzenia symlinków. Testy junction oraz niezależne testy strażników nadal działają; SKIP nie oznacza PASS.

Natywne testy używały wyłącznie własnych oznakowanych katalogów tymczasowych i losowych portów różnych od 55432/8080. Nie wykonywały zapytań do bazy właściciela ani żądań modelu. W teście backendu: jedna rozmowa, zero wiadomości, modelRequests=0. Java została zatrzymana przed PostgreSQL.

Pierwsza próba integracji backendu ujawniła błąd fixture: tabela dowodu zajmowała public przed pierwszą migracją. Flyway prawidłowo odmówił przy baseline-on-migrate=false. Fixture przeniesiono do smoke_evidence, a public sprawdzono jako puste; ponowienie zakończyło się PASS. Nie osłabiono migracji. Katalog nieudanej próby jarvis-pg-native-smoke-ZAPutU pozostał w TEMP, z oboma procesami zatrzymanymi.

## Nowy artefakt — przygotowany, niezainstalowany

- Plik: dist/jarvis-17-5/J.A.R.V.I.S.-Setup-1.0.3-x64.exe.
- Rozmiar: 663858522 B.
- SHA-256: 1a2bad29c9650c4e5e1a0c307b9d35fec3c0db9c8e41958110b60402a1320b53.
- Manifest: dist/jarvis-17-5/stage17-5-build.json.
- model_bundled=false; github_release_upload_ready=false.
- app.asar zawiera aktualne moduły produkcyjne zgodne z checkoutem; brak testów, backupów, GGUF i prywatnych danych.
- Świeżo zbudowany i wystagowany backend JAR zawiera pięć migracji i zero backupów konfiguracji.
- Licencje trafiają do resources/llm/licenses, rozpoznawanego przez oryginalny audyt.
- Pierwsza kontrola po buildzie wykryła błąd separatorów ścieżek w samym verifierze ASAR na Windows. Dodano path.normalize i regresję z zagnieżdżoną zależnością; ponowny verifier PASS. Produkcyjny ASAR nie wymagał zmiany.

Wersja pozostała 1.0.3; nie jest to test aktualizacji do wyższej wersji. Instalator jest niepodpisany. Nie instalowano go na profilu właściciela i nie publikowano wydania.

## Najważniejszy stan profilu właściciela — bez zmian

Ostatni odczyt potwierdził:
- %APPDATA%/JarvisData/postgres17/data/PG_VERSION = 17.
- Proces PostgreSQL PID 32588 nasłuchuje wyłącznie 127.0.0.1:55432; postmaster.pid wskazuje ten klaster.
- Brak %APPDATA%/JarvisData/backend.env.
- Brak postgres17/state.json oraz postgres17/credentials.json.
- Dawny %APPDATA%/J.A.R.V.I.S./postgres17 również pozostał zachowany.

To częściowa inicjalizacja. Nie potwierdzono zawartości jarvis_db ani historii właściciela. Nie wykonywać initdb, nie usuwać/przenosić klastra, nie dorabiać state.json, nie kopiować aktywnego data jako gotowej kopii bazy i nie poluzowywać pg_hba.conf/ACL.

Zainstalowany wcześniej app.asar zawierał już zmianę JarvisData i przed tymi naprawami zgadzał się z czterema modułami repo. Teraz pozostaje starszy od nowego buildu 17.6.10. Sam rebuild nie naprawia niekompletnego klastra.

## Co naprawiono

- desktop/electron/postgres-process.cjs: pg_ctl przez spawn z shell:false, windowsHide:true i stdio:ignore; wynik na exit, bez oczekiwania na uchwyty potomnego procesu.
- desktop/electron/postgres-first-run.cjs: prywatny ACL rodzica przed zapisami; credential odzyskiwania przed initdb; zachowanie częściowego stanu; wykrywanie legacy; bez automatycznej migracji.
- Cleanup nie identyfikuje serwera wyłącznie po porcie/czasie: wymaga markera dokładnego klastra, niezmienionego PID i potwierdzonego przez CIM łańcucha postgres.exe → cmd.exe → PID własnego pg_ctl.
- desktop/electron/postgres-runtime.cjs i runtime-lifecycle.cjs: skoordynowane start/abort/stop; Java kończy pracę przed PostgreSQL.
- desktop/electron/main.cjs: pojedyncza instancja aplikacji, oczekiwanie na shutdown, ochrona przed późnym startem po quit.
- Backend i Qwen czekają na exit/close własnego procesu; timeout i ponowienie quit mają testy.
- Backend używa JarvisData również w testach domyślnej ścieżki; szablon nie zawiera gotowego hasła.
- tools/desktop17/postgres17_windows.py: domyślna ścieżka JarvisData i aktualny help; żadnej migracji rzeczywistych danych.
- Pakowanie: licencje licenses/, rozdzielenie testów źródeł od kontroli artefaktu, wspólny manifest SHA/size po buildzie, wykluczenia testów/backupów/sekretów/modelu.
- backend/pom.xml wyklucza backupy z zasobów JAR.
- Frontend: testy trzech zakładek i Radio w toolbarze; poprawiony mock treningu; wygląd i zachowanie UI zachowane.
- CI: Chromium E2E; Windows wskazuje pełny stage17-5 i wymaga zaufanego stagingu. Publikacja dodatkowo wymaga jawnego github_release_upload_ready=true; statyczny build zawsze pozostawia false.

## Porządki

Trwałe usunięcie odtwarzalnych katalogów zostało odrzucone przez automatyczną kontrolę narzędzia (blocked by policy). Zastosowano odwracalne przeniesienie do:
C:/Users/bawar/AppData/Local/Temp/JarvisCleanup-2bbd59af2ebd4d77b33014a5fc14c1e1.

Mapa przywrócenia: restore-map.json w tym katalogu. Przeniesiono 33783322 B:
- frontend/.angular
- frontend/test-results
- tools/desktop17/__pycache__
- desktop/.jarvis-build

Nie usunięto danych aplikacji, modelu, dawnych instalatorów, unikalnych backupów ani archiwum .jarvis-stage17-2-backups.zip (6437965661 B; zawiera model i konfigurację). Dodano reguły .gitignore chroniące konfigurację, backupy i wyniki testów. Starsze usunięcia dokumentacji i kopii ZIP w Git były obecne przed tą sesją; nie przywracano ich ani nie rozszerzano.

## Następne działania

1. Po świadomej zgodzie właściciela: kontrolowane zatrzymanie wskazanego klastra, prywatna kompletna kopia offline, następnie plan odzyskania poświadczeń i weryfikacja faktycznej zawartości. Nie zgadywać hasła i nie resetować zabezpieczeń bez zgody.
2. Po zabezpieczeniu stanu: instalacja przygotowanego EXE, first-run na profilu właściciela i osobnym koncie/VM, Qwen provisioning/offline, czat, shutdown, failed-start, upgrade/rollback i uninstall z retencją.
3. Wypełnić ręczną checklistę wyłącznie wynikami rzeczywistych testów. Domknąć podpis i niezależny przegląd prawny/bezpieczeństwa.
4. Ponowić oryginalny Release Gate. Ostatni raport:
dist/jarvis-17-5/audit-17-6-10/17-6-3-20261111T212810Z-d448a07d/report.md.
Nowy NSIS ma PASS zasobów, bootstrapu, izolacji danych i licencji. BLOCKED dotyczy starej instalacji (licencje i różny ASAR) oraz scenariuszy ręcznych; Authenticode WARN.

## Polecenia

Z katalogu głównego, PowerShell:
~~~powershell
$tests = @(rg --files desktop/electron scripts -g '*.test.cjs')
node --test @tests tools/desktop17/test_builder_config_17_5.cjs
python -B -m unittest discover -s tools/desktop17 -p 'test_*.py'
node scripts/verify-release-artifact.cjs
node scripts/postgres-native-smoke.cjs --run --with-backend
~~~

Test natywny jest opt-in i używa tylko własnego tymczasowego klastra. Nie zastępuje pełnego uruchomienia Electrona na docelowym profilu.
