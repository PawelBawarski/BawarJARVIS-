# J.A.R.V.I.S. — Memory & RAG V1 (20.4)

## Cel

Zakończyć wersję V1 z lokalnym wyszukiwaniem wiedzy oraz bezpiecznym, zrozumiałym podglądem źródeł w Chat. Bez zmiany istniejących tabel PostgreSQL, importu dokumentów, indeksowania embeddingów ani samego promptu Qwen.

### Co pokazuje panel Chat

- Dla ostatniego pytania, na żądanie, pobiera do pięciu **aktualnie dopasowanych** fragmentów `jarvis_knowledge`.
- Wyniki mogą być tekstowe (`text`) lub semantyczne (`semantic`), zależnie od dostępności lokalnego modelu embeddingowego na porcie 8766.
- Prezentuje tytuł, bezpiecznie przycięty cytat, sposób dopasowania i opcjonalny link HTTP(S). Lokalnych identyfikatorów (`local://`, `jarvis://`), `file:`, `javascript:` nie zmienia na linki.
- Nigdy sam nie uruchamia wyszukiwania, nie indeksuje ani nie zapisuje notatek/rozmów. Wszystkie akcje są ręczne i tylko do odczytu.
- Zmiana rozmowy lub pytania ukrywa stare wyniki. Nieaktualne odpowiedzi HTTP nie nadpisują nowej rozmowy.
- `POST /api/research/context/preview` przyjmuje `{ "question": "..." }` w ciele, aby pytanie nie pojawiało się w zwykłym URL dostępowym. Endpoint wymaga `ROLE_JARVIS`.

### Ograniczenie uczciwości źródeł

**To podgląd źródeł dopasowanych w chwili kliknięcia, NIE zapis dokładnych źródeł rzeczywiście użytych przez model podczas generowania historycznej odpowiedzi.** Zawartość pamięci lub indeks embeddings mogą zmienić się między wysłaniem pytania a sprawdzeniem źródeł. Model Qwen może też uzupełnić odpowiedź wiedzą wewnętrzną. Wprowadzanie „gwarantowanych cytatów” wymaga przechowania listy źródeł przypisanej do danej odpowiedzi wraz z momentem generowania i walidacji.

## Instalacja Git Bash

1. Zapisz plik `JARVIS_STAGE_20_4_MEMORY_RAG_V1.patch` w `~/Downloads/`.

```bash
cd ~/Desktop/Nauka/BawarJARVIS-
git apply --check ~/Downloads/JARVIS_STAGE_20_4_MEMORY_RAG_V1.patch && \
git apply ~/Downloads/JARVIS_STAGE_20_4_MEMORY_RAG_V1.patch

cd frontend
node scripts/install-stage20-4.cjs
```

Instalator działa ponownie bez duplikacji, tworzy kopie `*.backup-before-stage20-4`, dopisuje wyłącznie 9 kluczy w PL/EN oraz dołącza jeden komponent Angulara do Chat. Nie wymaga nowych modeli ani pobierania pakietów.

## Testy

```bash
cd ~/Desktop/Nauka/BawarJARVIS-/frontend
node --test scripts/install-stage20-4.test.cjs
npm run check:i18n
npm test -- --watch=false
npm run build
npx playwright test e2e/memory-rag-sources-20-4.e2e.spec.ts \
  e2e/memory-semantic-20-3.e2e.spec.ts \
  e2e/memory-document-import-20-2.e2e.spec.ts

cd ../backend
./mvnw.cmd -Dtest=RagSourcePreviewServiceTest,SemanticMemoryServiceTest,KnowledgeMemoryServiceTest,DocumentMemoryServiceTest test
```

Uwaga: backend wymaga działającego PostgreSQL i poprawnych poświadczeń w `.env.jarvis`. Przy błędzie SQLSTATE 28P01 nie kasuj wolumenu. Uruchamiaj z `npm run dev:web:ai`, który ładuje `.env.jarvis`; `./mvnw.cmd spring-boot:run` bez zmiennych środowiskowych może użyć innego hasła.

## Ręczna kontrola V1

1. Upewnij się, że testy etapu 20.3 przechodzą, a migracje Flyway do V9 są wykonane.
2. W AI Lab -> Research Memory dodaj notatkę (np. „Angular Signals”) lub zaimportuj dokument z tekstem i zatwierdź zapis.
3. W Chat zapytaj o temat zapisanej notatki. Po otrzymaniu odpowiedzi kliknij **Sprawdź źródła**.
4. Sprawdź tytuł, fragment, metodę dopasowania i ostrzeżenie, że nie są to gwarantowane cytowania odpowiedzi.
5. Wyłącz model embeddingowy 8766: zwykłe wyszukiwanie tekstowe powinno nadal działać.
6. Sprawdź pytanie bez dopasowania: panel powinien pokazać komunikat pustych wyników.
7. Zmień rozmowę w czasie pobierania źródeł: nie może wyświetlić źródeł z poprzedniej rozmowy.

## Kryterium zamknięcia Memory & RAG V1

- Flyway V7–V9 działają na lokalnej bazie (bez utraty poprzednich danych).
- Ręczne notatki i import PDF/TXT/Markdown działają; dokument można usunąć wraz z jego fragmentami.
- Ręczne indeksowanie działa po uruchomieniu lokalnych embeddingów; w razie ich braku następuje fallback tekstowy.
- Chat generuje odpowiedzi z Qwen3 8B. Podgląd aktualnych dopasowań jest poprawnie oznaczony.
- Testy Java, Angular oraz E2E przechodzą u użytkownika.

## Dokładne ścieżki nowych plików względem BawarJARVIS-

- `backend/src/main/java/pl/bawar/jarvis/research/RagSourcePreviewService.java`
- `backend/src/main/java/pl/bawar/jarvis/research/RagSourcePreviewController.java`
- `backend/src/test/java/pl/bawar/jarvis/research/RagSourcePreviewServiceTest.java`
- `frontend/src/app/core/services/rag-source-preview-api.ts`
- `frontend/src/app/features/chat/chat-rag-sources/chat-rag-sources.ts`
- `frontend/src/app/features/chat/chat-rag-sources/chat-rag-sources.html`
- `frontend/src/app/features/chat/chat-rag-sources/chat-rag-sources.scss`
- `frontend/src/app/features/chat/chat-rag-sources/chat-rag-sources.spec.ts`
- `frontend/scripts/install-stage20-4.cjs`
- `frontend/scripts/install-stage20-4.test.cjs`
- `frontend/e2e/memory-rag-sources-20-4.e2e.spec.ts`
- `frontend/docs/STAGE_20_4_MEMORY_RAG_V1.md`
