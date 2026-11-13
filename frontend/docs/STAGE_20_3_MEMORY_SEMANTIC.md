# J.A.R.V.I.S. 20.3 — lokalne embeddingi + hybrydowe RAG

Rozbudowa etapów 20.1 (PostgreSQL full-text) i 20.2 (import PDF/TXT/Markdown). **Nie zastępuje ich**.

## Zachowanie

- Domyślnie `JARVIS_EMBEDDINGS_ENABLED=false`; Chat i Research Memory zachowują wyszukiwanie tekstowe.
- Opcjonalny, ODDZIELNY serwer Qwen3-Embedding-0.6B na `127.0.0.1:8766` udostępnia `/v1/embeddings`. Qwen3-8B na porcie 8765 pozostaje modelem czatu.
- `POST /api/research/semantic/index-next` (ROLE_JARVIS) zapisuje wektory maksymalnie 5 fragmentów na żądanie. Import dokumentu nie generuje embeddingów automatycznie.
- Wektory float32 trafiają do PostgreSQL `jarvis_knowledge_embeddings`, wiersze są kaskadowo usuwane z dokumentem/notatką. Obecna tabela `jarvis_knowledge` pozostaje źródłem tekstu. Nie potrzeba pgvector.
- Zmiana tekstu powoduje zmianę SHA-256: nieaktualne wektory nie uczestniczą w wyszukiwaniu i są ponownie indeksowane na żądanie.
- `GET /api/research/semantic/search?q=...` wyszukuje z użyciem embeddingów, dołącza wyniki pełnotekstowe, a w razie niedostępności modelu wraca do zapytania tekstowego.
- Chat, jeśli embeddingi są włączone, korzysta z tej samej hybrydowej pamięci (do 2 fragmentów); w przeciwnym razie zachowuje dotychczasową funkcję.

## Granice i bezpieczeństwo

- Wszystkie REST API wymagają `ROLE_JARVIS` (istniejące uwierzytelnienie).
- Adres embeddingów jest stały w backendzie `http://127.0.0.1:8766/v1/embeddings`, redirect jest wyłączony. Nic nie trafia do usług zewnętrznych; model pobierasz i uruchamiasz samodzielnie.
- Serwer embeddingów nie jest automatycznie uruchamiany przez `npm run dev:web:ai`, nie następuje automatyczny download.
- Limit zapytania 500 znaków, maksymalnie 1600 znaków na embedding dokumentu. Batch 5, skan maksymalnie 5000 najnowszych fragmentów. To V1 do lokalnej bazy; przy dużym zbiorze potrzeba paginacji i ANN/pgvector.
- Heurystyczny próg podobieństwa 0.45 może zwracać wyniki nieadekwatne; **PASS nie oznacza trafności odpowiedzi**. Dokumenty i notatki pozostają niezaufanymi danymi, nigdy instrukcjami.
- Status `configured=true` oznacza włączoną funkcję, nie potwierdza działania serwera embeddingów ani ukończenia indeksacji.
- Przy wyłączonym/niedostępnym embedding server zwykłe wyszukiwanie tekstowe pozostaje czynne, natomiast ręczne indeksowanie odmówi zapisu.
- Przy indeksowaniu nie przetwarza się rozmów, tylko wcześniej zatwierdzone notatki i fragmenty dokumentów.

## Uruchomienie — dwa terminale Git Bash (Windows)

1. Pobierz `Qwen3-Embedding-0.6B-Q8_0.gguf` z https://huggingface.co/Qwen/Qwen3-Embedding-0.6B-GGUF/tree/main do `%USERPROFILE%/JarvisAI/models/` (ok. 639 MB).
2. Terminal A — osobny model (binarium `llama-server.exe` z etapu 18.1):

```bash
"$HOME/JarvisAI/llama/llama-server.exe" \
  --model "$HOME/JarvisAI/models/Qwen3-Embedding-0.6B-Q8_0.gguf" \
  --embedding --pooling last \
  --alias jarvis-qwen3-embedding-0.6b \
  --host 127.0.0.1 --port 8766 \
  --ctx-size 2048 --n-gpu-layers 0 --offline --no-webui
```

3. Terminal B (z repo):

```bash
cd ~/Desktop/Nauka/BawarJARVIS-/frontend
export JARVIS_EMBEDDINGS_ENABLED=true
export JARVIS_EMBEDDINGS_MODEL=jarvis-qwen3-embedding-0.6b
npm run dev:web:ai
```

4. W `AI Lab -> Research Memory -> Wyszukiwanie semantyczne` kliknij **Sprawdź konfigurację**, a potem ręcznie **Indeksuj kolejne 5 fragmentów** aż licznik będzie aktualny. Status liczy wszystkie wektory modelu, również te wymagające odświeżenia po edycji.
5. Test: zapisz notatkę „Falownik zmienia częstotliwość zasilania silnika”, zindeksuj i wyszukaj „Jak sterować obrotami motoru?”. Porównaj z tekstowym wynikiem, następnie zadaj podobne pytanie w Chat.

## Instalacja i testy

```bash
cd ~/Desktop/Nauka/BawarJARVIS-
git apply --check ~/Downloads/JARVIS_STAGE_20_3_SEMANTIC_RAG.patch && \
git apply ~/Downloads/JARVIS_STAGE_20_3_SEMANTIC_RAG.patch
cd frontend
node scripts/install-stage20-3.cjs
node --test scripts/install-stage20-3.test.cjs
npm run check:i18n
npm test -- --watch=false
npm run build
npx playwright test e2e/memory-semantic-20-3.e2e.spec.ts
cd ../backend
./mvnw.cmd -Dtest=SemanticVectorTest,SemanticMemoryServiceTest,KnowledgeMemoryServiceTest test
```

Flyway automatycznie wykonuje `V9__knowledge_embeddings.sql` przy kolejnym starcie Spring Boot (wymagane V7 i V8). Całość przetestuj najpierw na lokalnej, nieprodukcyjnej bazie. Backend musi używać Javy 21 (`<java.version>21</java.version>` w pom.xml).

W razie błędu `SEMANTIC_MODEL_UNAVAILABLE` upewnij się, że `curl.exe http://127.0.0.1:8766/health` odpowiada i alias w uruchomionym serwerze odpowiada zmiennej `JARVIS_EMBEDDINGS_MODEL`. Nie kopiuj sekretów do logów.

## Ważne pliki

- `backend/src/main/java/pl/bawar/jarvis/research/LocalEmbeddingClient.java` — klient tylko loopback
- `backend/src/main/java/pl/bawar/jarvis/research/SemanticVector.java` — wektory i SHA
- `backend/src/main/java/pl/bawar/jarvis/research/SemanticMemoryService.java` — indeksacja/hybrydowe retrieval
- `backend/src/main/java/pl/bawar/jarvis/research/SemanticMemoryController.java` — API
- `backend/src/main/resources/db/migration/V9__knowledge_embeddings.sql` — tabela PostgreSQL
- `backend/src/test/java/pl/bawar/jarvis/research/SemanticVectorTest.java`
- `backend/src/test/java/pl/bawar/jarvis/research/SemanticMemoryServiceTest.java`
- `frontend/src/app/core/services/research-semantic-api.ts`
- `frontend/src/app/features/ai-lab/research-memory/semantic-memory/{semantic-memory.ts,semantic-memory.html,semantic-memory.scss,semantic-memory.spec.ts}`
- `frontend/e2e/memory-semantic-20-3.e2e.spec.ts`
- `frontend/scripts/install-stage20-3.cjs` i `.test.cjs`
- `frontend/docs/STAGE_20_3_MEMORY_SEMANTIC.md`

Instalator jedynie dołącza panel do Research Memory, zachowuje słowniki i przełącza Chat na wyszukiwanie semantyczne tylko wtedy, gdy jest ono aktywne. Tworzy backup zmienianych plików, nie dotyka `.env` ani plików z sekretami.
