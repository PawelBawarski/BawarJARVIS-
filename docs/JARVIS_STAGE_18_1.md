# J.A.R.V.I.S. 18.1 — lokalny Qwen w wersji webowej

## Cel

Uruchamianie istniejącej integracji Angular Chat → Spring Boot → Qwen3 8B (llama.cpp) → PostgreSQL bez starego `desktop/`, instalatora i zarządzania bazą przez Electron.

## Wymagania

1. Działający PostgreSQL z `backend/compose.db.yml` (`127.0.0.1:5433`) oraz niepublikowany `backend/.env.jarvis` z hasłem bazy.
2. Java 21, Node.js i zależności npm w `frontend/`.
3. Lokalnie dostępny, zaufany `llama-server.exe` (llama.cpp) oraz plik modelu Qwen3 8B w formacie GGUF. Modelu **nie umieszczaj** w repozytorium.
4. RAM/VRAM wystarczające dla wybranej kwantyzacji. `JARVIS_GPU_LAYERS=0` działa w trybie CPU; dla odpowiedniego GPU można zwiększyć liczbę warstw.

## Konfiguracja ścieżek na Windows (Git Bash)

W katalogu głównym `BawarJARVIS-`:

```bash
cp frontend/.env.model.example frontend/.env.model.local
notepad.exe frontend/.env.model.local
```

W `BawarJARVIS-/frontend/.env.model.local` ustaw prawdziwe **pełne ścieżki** dla Twojej maszyny (przykłady w `.env.model.example` nie są prawdziwymi plikami):

```dotenv
JARVIS_LLAMA_SERVER_PATH=C:/tools/llama.cpp/llama-server.exe
JARVIS_GGUF_PATH=C:/models/Qwen3-8B-Q4_K_M.gguf
JARVIS_GPU_LAYERS=0
JARVIS_CTX_SIZE=4096
```

Plik `.env.model.local` jest ignorowany przez Git. Nie wpisuj do niego klucza modelu: skrypt tworzy **losowy klucz dla każdej sesji developerskiej** i przekazuje go Spring Boot jako `JARVIS_LLM_API_KEY`, a `llama-server` jako `LLAMA_API_KEY`. Klucz nie trafia do kodu Angular, przeglądarki ani argumentów CLI.

## Uruchomienie

```bash
cd ~/Desktop/Nauka/BawarJARVIS-/backend
docker compose --env-file .env.jarvis -f compose.db.yml up -d

cd ~/Desktop/Nauka/BawarJARVIS-/frontend
npm run dev:web:ai
```

Skrypt sprawdza ścieżki, wolny port 8765, uruchamia `llama-server` **wyłącznie na 127.0.0.1**, w trybie offline, sprawdza `GET /health` oraz autoryzowane `GET /v1/models` (alias `jarvis-qwen3-8b`). Dopiero po gotowości Qwen uruchamia Spring Boot i Angular.

- Angular: `http://127.0.0.1:4200/`
- Spring Boot: `http://127.0.0.1:8080/`
- Qwen: `http://127.0.0.1:8765/` (tylko loopback)
- Status modelu przez developer-proxy: `http://127.0.0.1:4200/api/chats/model-status`

Oczekiwany JSON po pełnym uruchomieniu: `{"model":"jarvis-qwen3-8b","ready":true}`. Status jest pobierany z backendu i można go ręcznie odświeżyć w module Chat.

Dla opcjonalnego okna developerskiego Electron: `npm run dev:electron:ai`. Klasyczne `npm run dev:web` pozostaje bez automatycznego startu modelu; wtedy Chat zwraca 503 `LLM_NOT_READY` zamiast fikcyjnej odpowiedzi.

## Testy (dokładne ścieżki)

Z `BawarJARVIS-/frontend`:

```bash
npm run test:model
npm test -- --watch=false
npx playwright test e2e/chat-qwen-web-18-1.e2e.spec.ts
npm run build
```

Z `BawarJARVIS-/backend`:

```bash
./mvnw.cmd -Dtest=LocalLlmClientTest,ChatControllerTest,ChatApplicationServiceTest test
```

Testy Java sprawdzają wywołanie lokalnego klienta, kod zwrotny statusu i zasady zapisu rozmów. Testy Angular i Playwright sprawdzają status gotowości, uwierzytelniany transport przez proxy i zachowanie szkicu po błędzie 503.

## Bezpieczeństwo i ograniczenia

- **Wyłącznie środowisko developerskie na jednym komputerze.** Nie wystawiaj portów 4200, 8080 i 8765 publicznie.
- Serwer modelu uruchamiany tylko z istniejącej lokalnej binarki i istniejącego pliku GGUF; bez pobierania z internetu. `--offline --no-webui`.
- Nie usuwaj wolumenu PostgreSQL; zapis historii jest po stronie Spring Boot.
- Zatrzymaj całą sesję `Ctrl+C`, co kończy podprocesy uruchomione przez skrypt (nie zatrzymuje niezależnego Dockera).
- Jeśli model nie jest dostępny po usunięciu starego `desktop/`, zainstaluj ponownie osobno llama.cpp i pobierz GGUF zgodny z wybranym modelem; skrypt sam niczego nie pobiera.
- Jeśli model nie mieści się w pamięci GPU, zmniejsz `JARVIS_GPU_LAYERS` albo użyj odpowiedniej kwantyzacji (GGUF).

## Zakres zmian

- `frontend/scripts/model-runtime.cjs`, `model-runtime.test.cjs`, `dev-stack.cjs`
- `frontend/.env.model.example`, `.gitignore`, `package.json`
- `backend/src/main/java/pl/bawar/jarvis/chat/api/LocalLlmClient.java`, `ChatApplicationService.java`, `ChatController.java`
- testy Java w `backend/src/test/java/pl/bawar/jarvis/chat/api/`
- `frontend/src/app/core/services/{browser-api.ts, chat-api.ts}` i testy
- `frontend/src/app/features/chat/chat-view/*` oraz `frontend/public/i18n/{pl,en}.json`
- `frontend/e2e/chat-qwen-web-18-1.e2e.spec.ts`

W środowisku przygotowania patcha wykonano 6/6 testów Node.js, kontrolę składni JS i symulację zastosowania patcha. Uruchomienie Qwen z prawdziwym modelem, pełny Angular/Playwright oraz Maven/JUnit wymagają sprawdzenia na docelowym Windows.
