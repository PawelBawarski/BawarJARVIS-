# J.A.R.V.I.S. — kompletna paczka Offline Brain + AI Lab Learning/Training/Reasoning

## Zakres i ograniczenia

Ta paczka realizuje samodzielny, rozszerzalny **prototyp silnika wiedzy**, napisany w Java 21 standard library, bez Ollama, bez pobierania wag i bez usług chmurowych. Umożliwia:

- **12.6 Offline Brain:** lokalne API + pobieranie fragmentów wiedzy i kalkulator matematyczny.
- **13.0 Learning:** dodawanie dokumentów tekstowych, trwała baza w profilu użytkownika, kontrolowany podgląd wybranych źródeł HTTPS i **zatwierdzanie przed zapisem**.
- **13.1 Training:** prawdziwe uczenie 4-parametrowego klasyfikatora rankingu źródeł (SGD, etykiety pozytywne/negatywne), deterministyczny podział trening/walidacja, kontrola jakości i rollback.
- **13.2 Reasoning:** wybór strategii (działanie matematyczne lub wyszukiwanie w dokumentach), źródła, krótki dziennik etapów i odmowa zgadywania przy braku danych.
- Panel Angular z 4 oddzielnymi plikami + testy Vitest i Playwright.
- 27 automatycznych asercji Java (przy aktualnym stanie paczki), w tym autoryzacja, CORS, przechowywanie danych, brak halucynowania, walidacja URL i rollback.

**To NIE jest LLM o inteligencji GPT.** Moduł nie generuje swobodnie nowych odpowiedzi: zwraca fragmenty źródeł lub wynik kalkulatora. Trening rankera NIE trenuje dużego modelu językowego, a 10 GB VRAM karty RTX 3080 nie jest w nim wykorzystywane. Pozyskanie zaawansowanych umiejętności konwersacyjnych będzie wymagało wytrenowanych wag modelu i silnika inferencji albo wielkiego kosztu treningu od zera.

## Wymagania

- Windows 11, zainstalowany **JDK 21** (`java -version` i `javac -version`). Masz go już do projektu.
- Python 3.13 do jednorazowego uruchomienia instalatora — masz go już w swoim środowisku.
- Angular/Vitest/Playwright używane już przez istniejące repo.
- Brak dodatkowych programów, zależności Java, Ollama czy API key.

## Instalacja — jedna paczka

1. Zapisz `apply_jarvis_ai_full_12_6_13_2.py` bezpośrednio w folderze `BawarJARVIS-`.
2. Uruchom:

```bash
cd ~/Desktop/Nauka/BawarJARVIS-
python apply_jarvis_ai_full_12_6_13_2.py --dry-run
python apply_jarvis_ai_full_12_6_13_2.py
```

Instalator nie usunie żadnego istniejącego pliku. W razie kolizji zatrzyma się bez zmian; aby świadomie nadpisać pliki pakietu, użyj `--force` (automatyczna kopia zapasowa). Modyfikacje istniejących `ai-lab-view.ts` i `ai-lab-view.html` otrzymują backup w `.jarvis-ai-backups/<timestamp>/`.

## Uruchomienie silnika offline

Z katalogu `BawarJARVIS-`:

```bash
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/offline-brain/test.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/offline-brain/start.ps1
```

Odczytaj token `JARVIS_OFFLINE_BRAIN_TOKEN=...` z terminala. Serwer działa wyłącznie na `http://127.0.0.1:8766`. Nie zapisuj tokena w repozytorium ani nie udostępniaj nikomu.

W **drugim** terminalu uruchom znany już frontend:

```bash
cd frontend
npm test -- --watch=false
npm run build
npx playwright test e2e/ai-learning-training-reasoning.e2e.spec.ts
npm start
```

W module AI Lab wyświetli się panel Learning/Training/Reasoning (jeśli instalator pomyślnie podłączył komponent). Wklej token w pole, kliknij **Połącz / odśwież**. Token jest przechowywany w pamięci komponentu, nie w localStorage.

Wersja produkcyjna Electrona wymaga jeszcze sprawdzenia dokładnego `jarvis://` origin i integracji uruchamiania usługi Java z cyklem życia procesu Electron; instalator nie modyfikuje istniejących plików bezpieczeństwa Electron.

## Testy i kryteria akceptacji

1. JDK 21 kompiluje 6 plików produkcyjnych i testy.
2. Testy Java pokazują `PASS: 27 local Java assertions` (liczba może rosnąć po ulepszeniach).
3. Backend API po uruchomieniu zwraca `{"ok":true,"mode":"offline","llm":false}` z `GET /api/ai/health`.
4. Bez tokenu każde API poza health zwraca 401.
5. Pytanie bez dokumentów odpowiada, że brakuje danych; po dodaniu dokumentu zwraca fragment i jego źródło.
6. Trening wymaga >= 8 ocen; raportuje walidację i nie zapisuje pogorszonego modelu.
7. Import HTTPS nie zapisuje tekstu przed osobnym kliknięciem **Zatwierdź import**.
8. Angular build i testy E2E przechodzą w Twoim aktualnym repozytorium. **Nie mogłem ich zweryfikować bez aktualnych plików repo**.

## Bezpieczeństwo

- Serwer wiąże się tylko z `127.0.0.1`, wymaga losowego tokenu i weryfikuje Origin. Brak dostępu do plików workspace.
- Import sieciowy ma ograniczone domeny, HTTPS, brak przekierowań, limit rozmiaru, blokadę prywatnych IP po wstępnym DNS i akceptację użytkownika przed zapisem.
- Znane ograniczenie: walidacja DNS przed wysłaniem żądania NIE gwarantuje pełnej ochrony przed DNS rebinding. Nie rozszerzaj allowlisty na nieznane domeny bez bardziej rygorystycznej warstwy sieciowej.
- Filtr sekretów oparty na wzorcach nie gwarantuje wykrycia wszystkich danych wrażliwych: nie wklejaj .env, tokenów ani haseł.
- Dokumenty i etykiety są traktowane jako nieufne dane. Żaden z nich nie jest wykonywany jako kod ani komenda.
- Dane są przechowywane pod `C:\Users\<użytkownik>\.jarvis-ai` (poza repo). Nie umieszczaj ich w Git.
- Brak autonomicznych treningów i brak harmonogramu web-crawling. To świadome zabezpieczenie: dopiero po walidacji źródeł i aktualizacji polityki zaufania można będzie dodać bezpieczną automatyzację.

## Dokładne ścieżki plików względem BawarJARVIS-

- `tools/offline-brain/src/main/java/jarvis/offline/Json.java`
- `tools/offline-brain/src/main/java/jarvis/offline/LocalStore.java`
- `tools/offline-brain/src/main/java/jarvis/offline/Calculator.java`
- `tools/offline-brain/src/main/java/jarvis/offline/BrainEngine.java`
- `tools/offline-brain/src/main/java/jarvis/offline/WebPreviewer.java`
- `tools/offline-brain/src/main/java/jarvis/offline/ServerMain.java`
- `tools/offline-brain/src/test/java/jarvis/offline/OfflineBrainTests.java`
- `tools/offline-brain/start.ps1`
- `tools/offline-brain/test.ps1`
- `frontend/src/app/features/ai-lab/learning-lab/learning-lab.ts`
- `frontend/src/app/features/ai-lab/learning-lab/learning-lab.html`
- `frontend/src/app/features/ai-lab/learning-lab/learning-lab.scss`
- `frontend/src/app/features/ai-lab/learning-lab/learning-lab.spec.ts`
- `frontend/e2e/ai-learning-training-reasoning.e2e.spec.ts`
- `docs/JARVIS_AI_12_6_13_2_INSTALL_PL.md`

Podczas automatycznej integracji dodatkowo edytowane mogą zostać istniejące pliki:

- `frontend/src/app/features/ai-lab/ai-lab-view.ts`
- `frontend/src/app/features/ai-lab/ai-lab-view.html`

Jeśli instalator zgłosi `UI INTEGRATION SKIPPED`, nie modyfikuj ich na ślepo: prześlij ich zawartość do dostosowania.

## Co NIE jest jeszcze zrobione

- Nie ma własnego GPT/LLM, trenowania pełnego transformera ani generowania tekstu z wag modelu.
- Nie ma automatycznego łączenia nowego silnika z dotychczasowym czatem rozmów (zachowujemy UI i API czatu bez naruszeń).
- Nie ma samodzielnego masowego skanowania internetu.
- Nie ma samoczynnego uruchamiania silnika z NSIS/Electron; do czasu integracji usługa jest uruchamiana skryptem PowerShell.
- Nie ma benchmarków RTX 3080; moduł działa na CPU i powinien mieć mały pobór energii.
