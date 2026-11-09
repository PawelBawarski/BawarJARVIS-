# J.A.R.V.I.S. — AI Lab 12.2: historia treningów i metryki

## Zakres

- Flyway `V2__ai_lab_training_history.sql` rozbudowuje tabelę `jarvis_training_runs`, dodaje `jarvis_training_epoch_metrics`, `jarvis_model_evaluations` oraz rozmiar archiwum checkpointu.
- Historia treningów, liczba epok, straty i oceny przeżywają restart Spring Boot.
- Przy **ręcznym** zapisie checkpointu Jarvis zachowuje również osobny, niezmienny plik w `snapshots/`, co pozwala porównać zapisane wersje zamiast nadpisywać jedyny plik.
- Historia nie zawiera tekstów treningowych ani walidacyjnych. Zapisywany jest jedynie skrót SHA-256 korpusu walidacyjnego (nie należy go traktować jako szyfrowania ani gwarancji poufności prostych danych).
- Frontend nie zna ścieżek systemowych ani sekretu sesji. Electron udostępnia tylko stałe trasy GET, a identyfikatory przebiegu ogranicza do UUID.

## Endpointy chronione `ROLE_JARVIS`

- `GET /api/ai-lab/history/runs`
- `GET /api/ai-lab/history/runs/{id}/epochs`
- `GET /api/ai-lab/history/checkpoints`
- `GET /api/ai-lab/history/evaluations`

Istniejący `POST /api/ai-lab/evaluate` zapisuje teraz również metryki i odcisk zbioru. Wszystkie endpointy pozostają w tej samej strefie autoryzacji. Trening i ręczne save/load wciąż korzystają z dotychczasowych endpointów i blokady.

## Jak porównujemy checkpointy?

1. Każda ręcznie zapisana wersja otrzymuje unikalny plik i SHA-256. Porównanie SHA-256 mówi, czy **pliki są identyczne**, nie ocenia jakości modelu.
2. Porównanie perplexity jest dopuszczone **tylko wtedy**, gdy obie wersje mają zarejestrowaną ewaluację na identycznym korpusie (ten sam `corpus_sha256`).
3. Najnowsza ewaluacja danego checkpointu jest wyświetlana na jego karcie; przy różnych korpusach pokazujemy brak porównywalności.
4. Przed ewaluacją użyj „Zapisz checkpoint”, bo w przeciwnym wypadku metryka opisuje tylko aktywny model i nie jest przypisana do pliku.
5. Obecny przycisk „Wczytaj checkpoint” nadal odtwarza **ostatni aktywny checkpoint**, nie dowolny snapshot z tabeli. Wybór historycznej wersji do załadowania to osobny etap z dodatkowymi kontrolami ścieżek i integralności.

## Zależności i testy

- Warunek: zakończone BE 11.2 (PostgreSQL/Flyway), BE 11.3 (Spring Security), AI Lab 12.1.
- Baza prawdziwa: `backend/.env.jarvis`, `compose.db.yml`, port `5433`.
- Testy JDBC z H2 to kontrola zgodności, ale migrację V2 warto potwierdzić również na prawdziwym PostgreSQL.
- Testy: `LabHistoryRepositoryTest`, `LabHistoryServiceTest`, `lab-history-ipc.test.cjs`, `history-panel.spec.ts`, `ai-lab-history.e2e.spec.ts`.

## Ograniczenia

- UI odświeża listy przy wejściu i ręcznie przyciskiem „Odśwież”. Po zakończeniu treningu użyj go, żeby zobaczyć wynik w archiwum.
- Wszelkie sekrety pozostają w procesie Electron Main; renderer jest traktowany jako niezaufany.
- Jedno zadanie treningowe naraz. Wygenerowana odpowiedź AI i ciężka ewaluacja mogą nadal na chwilę blokować współdzielony model.
- Ostatnie 30 treningów, checkpointów i ewaluacji widoczne w panelu. Starsze dane pozostają w bazie.
- **Nie zmieniaj V1** po zastosowaniu jej przez Flyway; V2 to migracja przyrostowa.
