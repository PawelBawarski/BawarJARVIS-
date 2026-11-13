# J.A.R.V.I.S. 20.1 — Memory & RAG, pamięć lokalna

## Co istnieje już wcześniej

`KnowledgeMemoryService` obsługuje zatwierdzanie fragmentów Wikipedii i dołączanie ich do pytań wysyłanych do Qwen przez `ChatApplicationService`. PostgreSQL przechowuje dane w `jarvis_knowledge` z migracji V4.

## Nowości 20.1

- Własne notatki tekstowe, **wyłącznie po kliknięciu Zapisz** (POST `/api/research/notes`). Brak automatycznego zapisywania rozmów.
- GIN + `tsvector` w migracji Flyway V7. Wyszukiwanie z parametrami SQL po wszystkich wpisach (GET `/api/research/matches?q=...`) zamiast sortowania tylko ostatnich 100 pozycji.
- Chat automatycznie **odczytuje** maksymalnie dwa dopasowane zatwierdzone źródła do kontekstu (RAG), ale **nigdy nie zapisuje** informacji z rozmowy do pamięci.
- Notatka lokalna ma identyfikator `jarvis://note/<UUID>` i nie generuje linku wychodzącego. Zwykłe artykuły zachowują URL źródła.
- Każda notatka: tytuł max 120 znaków, treść max 4000 znaków. Limit podanego wyszukiwania w HTTP: 500 znaków. Wyniki UI: max 10, podpowiedzi RAG: max 2 po max 750 znaków.
- Wymagany istniejący `ROLE_JARVIS`; nie ma nowego publicznego endpointu.

## Sposób instalacji

Pracuj w repozytorium `BawarJARVIS-` z już wdrożonym etapem 19.5:

```bash
cd ~/Desktop/Nauka/BawarJARVIS-
git apply --check ~/Downloads/JARVIS_STAGE_20_1_MEMORY_RAG.patch && \
git apply ~/Downloads/JARVIS_STAGE_20_1_MEMORY_RAG.patch
cd frontend
node scripts/install-stage20-1.cjs
```

Skrypt dopisuje 14 kluczy PL/EN, bez nadpisywania istniejących wpisów; tworzy kopię tylko przy rzeczywistej zmianie. Nie commituj `*.backup-before-stage-20-1`.

## Testy

```bash
cd ~/Desktop/Nauka/BawarJARVIS-/frontend
node --test scripts/install-stage20-1.test.cjs
npm run check:i18n
npm test -- --watch=false
npm run build
npx playwright test e2e/memory-local-search-20-1.e2e.spec.ts e2e/ai-lab-research.e2e.spec.ts

cd ../backend
./mvnw.cmd -Dtest=KnowledgeMemoryServiceTest,KnowledgeMemoryLocalTest,KnowledgeRankerTest test
```

Po uruchomieniu PostgreSQL i `npm run dev:web:ai` sprawdź, że Spring Boot wykona V7. W AI Lab -> Internet i pamięć wiedzy dodaj notatkę, odszukaj ją po słowie z treści, usuń i sprawdź ponownie. W Chat zadaj pytanie związane z tytułem notatki.

## Granice funkcji

- To **RAG tekstowy/pełnotekstowy**, bez embeddingów ani wektorowej bazy. `simple` działa dla PL/EN bez odmiany wyrazów; niektóre parafrazy nie dadzą trafienia.
- Nie wysyłamy wyszukiwanych fraz do Wikipedii; osobny przycisk „Szukaj” w Research Memory nadal wykonuje zewnętrzne wyszukiwanie Wikipedii tak jak wcześniej.
- Zawartość notatek jest **niezaufanym kontekstem**, nawet jeśli zatwierdzona przez użytkownika. Zapisy w pamięci nie nadają modelowi uprawnień do wykonywania narzędzi.
- Treść świadomie zapisanej notatki może zostać wysłana do *lokalnego* Qwen podczas odpowiadania na powiązane pytanie. Nie wpisuj sekretów.
- Migracja V7 tworzy indeks na istniejących wierszach; zależnie od liczby danych jej wykonanie może potrwać. Nie uruchamiaj jej w czasie aktywnych zapisów.
- Brak automatycznej pamięci konwersacyjnej i brak indeksowania dokumentów PDF/Word — to następne zadania.
