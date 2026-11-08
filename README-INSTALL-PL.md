# J.A.R.V.I.S. — instalacja LLM 10.12/10.12 (ostatnia lekcja LLM)

## Cel

Generowanie tokenów (`TextGenerator`), ewaluacja (`ModelEvaluator`) i wersjonowany checkpoint zawierający pełne wagi i stan optymalizatora AdamW (`ModelCheckpoint`). Projekt nadal jest edukacyjnym mini-LLM; nie jest jeszcze podłączony do bazy danych ani Angulara.

## 1. Ścieżki — od głównego katalogu `BawarJARVIS-/`

**Nowe pliki Java — SKOPIUJ:**

- `backend/src/main/java/pl/bawar/jarvis/brain/training/TextGenerator.java`
- `backend/src/main/java/pl/bawar/jarvis/brain/training/GenerationResult.java`
- `backend/src/main/java/pl/bawar/jarvis/brain/training/ModelEvaluator.java`
- `backend/src/main/java/pl/bawar/jarvis/brain/training/EvaluationMetrics.java`
- `backend/src/main/java/pl/bawar/jarvis/brain/training/ModelParameterRegistry.java`
- `backend/src/main/java/pl/bawar/jarvis/brain/training/ModelCheckpoint.java`
- `backend/src/main/java/pl/bawar/jarvis/brain/training/CheckpointDemo.java`
- `backend/src/main/java/pl/bawar/jarvis/brain/optimization/AdamWState.java`

**Nowe testy JUnit — SKOPIUJ:**

- `backend/src/test/java/pl/bawar/jarvis/brain/training/TinyTestModels.java` (pomocnik)
- `backend/src/test/java/pl/bawar/jarvis/brain/training/TextGeneratorTest.java` (4 testy)
- `backend/src/test/java/pl/bawar/jarvis/brain/training/ModelEvaluatorTest.java` (3 testy)
- `backend/src/test/java/pl/bawar/jarvis/brain/training/ModelCheckpointTest.java` (4 testy)

**Skrypt dopisujący małe API do istniejących klas — SKOPIUJ i URUCHOM:**

- `scripts/apply-llm-10-12.py`

Modyfikuje tylko te pliki (i tworzy kopie `*.llm1012.bak`):

- `backend/src/main/java/pl/bawar/jarvis/brain/optimization/AdamWOptimizer.java`
- `backend/src/main/java/pl/bawar/jarvis/brain/training/AdamWModelUpdater.java`
- `backend/src/main/java/pl/bawar/jarvis/brain/training/FullModelTrainer.java`

**Dokumentacja — SKOPIUJ / PORÓWNAJ PRZED PODMIANĄ:**

- `docs/LLM-10-12.md` — nowy dokument
- `.github/skills/jarvis-llm/SKILL.md` — aktualizacja istniejącego skillu Copilota
- `docs/JARVIS-ROADMAP.md` — zaktualizowana mapa kolejnych etapów
- `README-APPEND-10-12.md` — fragment, który można wkleić na koniec istniejącego `README.md` (nie zastępuj głównego README)

## 2. Instalacja Windows 11 / Git Bash

1. Zrób commit lub kopię projektu **przed** zmianami.
2. Rozpakuj ZIP osobno. Skopiuj nowe pliki do odpowiednich folderów, bez nadpisywania istniejących klas Java.
3. Przeczytaj aktualny lokalny skill i roadmapę; scalenie dokumentacji wykonaj świadomie, jeśli masz lokalne zmiany.
4. W katalogu `BawarJARVIS-/` uruchom:

```bash
cd ~/Desktop/Nauka/BawarJARVIS-
py -3 scripts/apply-llm-10-12.py
# lub: python scripts/apply-llm-10-12.py

git diff -- backend/src/main/java
```

Skrypt jest idempotentny: kolejne uruchomienie pomija już dodane metody. Gdy nie rozpozna struktury plików, kończy działanie **przed jakąkolwiek modyfikacją**.

## 3. Testy

```bash
cd ~/Desktop/Nauka/BawarJARVIS-/backend
./mvnw.cmd -Dtest=TextGeneratorTest,ModelEvaluatorTest,ModelCheckpointTest test
./mvnw.cmd clean test
```

Nowe pliki zawierają **11 testów JUnit**. Sprawdź także pozostałe testy z etapów 10.1–10.11.

## 4. Mini-demonstracja: zapis i wznowienie modelu

Przed demo dopisz do `.gitignore` w repo:

```gitignore
backend/checkpoints/
```

Następnie:

```bash
cd ~/Desktop/Nauka/BawarJARVIS-/backend
./mvnw.cmd -DskipTests compile
java -cp target/classes pl.bawar.jarvis.brain.training.CheckpointDemo
```

Checkpoint zostanie zapisany do `BawarJARVIS-/backend/checkpoints/jarvis-tiny-v1.ckpt`.

**Nie wgrywaj checkpointów ani historii rozmów automatycznie na GitHub.** SHA-256 wykrywa przypadkowe uszkodzenia, ale nie poświadcza pochodzenia danych.

## 5. Co jest jeszcze do wykonania po zakończeniu LLM?

- **BE-1:** autoryzowana usługa Java dla trenera i generowania, synchronizacja treningu/inferencji.
- **BE-2:** PostgreSQL, Flyway i migracje `conversations`, `messages`, `training_runs`, `checkpoints`.
- **BE-3:** API czatu i endpointy modelu (DTO, walidacja, transakcje, obsługa błędów).
- **FE-1:** Angular ChatStore z backendową historią zamiast trwałego localStorage, w tym testy Vitest + Playwright.
- **Desktop:** uporządkowanie IPC, uruchamiania backendu i obsługi offline.
- **Internet:** kontrolowane wyszukiwanie/aktualne informacje po stronie Spring Boot, ze źródłami i ochroną SSRF. Pobranie informacji NIE oznacza samodzielnego treningu wag.

## 6. Stan weryfikacji

11/11 nowych testów Java przeszło w izolowanym środowisku Java 21, z uproszczoną reprezentacją pozostałych modułów projektu. Nie są to testy wykonane na Twoim Windowsie ani pełny Maven całego repozytorium. Rekomendowany ostatni krok: uruchom `./mvnw.cmd clean test` na swoim projekcie.
