# J.A.R.V.I.S. — Local Intelligence 14.0 + pomoc kontekstowa

**Zawartość paczki:** Java 21 / Spring Boot (klient lokalnego Qwen), Electron (lokalny proces llama.cpp), Angular (czat i okno pomocy) oraz testy. Poprzedni mały Transformer pozostaje do eksperymentów w AI Lab, ale nie jest już źródłem odpowiedzi czatu.

## Ważne: model i binaria nie są częścią tego ZIP

Ten ZIP zawiera **kod integracji**, a nie 5-gigabajtowe wagi modelu. Aby uzyskać kompletną, offline dystrybucję, podczas przygotowania programu należy raz pobrać Qwen3 8B Q4_K_M i przenośny llama.cpp dla Windows / NVIDIA CUDA. Skrypt używa Pythona z biblioteki standardowej, automatycznie weryfikuje SHA-256 plików pobranych z oficjalnych źródeł i nie wymaga instalacji Ollama ani osobnego CUDA Toolkit. Potrzebny jest istniejący sterownik NVIDIA.

Nie zostało potwierdzone, że kompletny wielogigabajtowy instalator NSIS zbuduje się na konkretnym Windowsie. Konfigurację pakowania i ograniczenia rozmiaru należy sprawdzić na komputerze użytkownika.

## 1. Instalacja kodu z jednej paczki

1. Rozpakuj ten ZIP **do** `BawarJARVIS-/_jarvis_local_ai_14/`. Plik `install.py` musi znajdować się bezpośrednio w tym katalogu.
2. W Git Bash uruchom:

```bash
cd ~/Desktop/Nauka/BawarJARVIS-
python _jarvis_local_ai_14/install.py --dry-run
python _jarvis_local_ai_14/install.py
```

Instalator zatrzymuje się na nieznanych wersjach plików, tworzy `.jarvis-local-llm-backups/` i manifest. Nie nadpisuje dowolnych zmian bez sprawdzenia sum kontrolnych.

**Cofnięcie kodu** (przed własnymi modyfikacjami plików):

```bash
python _jarvis_local_ai_14/install.py --rollback
```

## 2. Jednorazowe pozyskanie i sprawdzenie zasobów AI

```bash
python tools/local-ai/prepare_assets.py
python tools/local-ai/prepare_assets.py --verify
```

Skrypt umieszcza model i przenośny runtime w:

```text
BawarJARVIS-/desktop/ai-runtime/models/Qwen3-8B-Q4_K_M.gguf
BawarJARVIS-/desktop/ai-runtime/bin/llama-server.exe
```

`desktop/ai-runtime/` jest pomijany przez Git (rozmiar w GB). **Nie wrzucaj wag do GitHub.** Przygotowanie zasobów wymaga internetu jednorazowo; zbudowana aplikacja może potem odpowiadać offline.

**Model:** https://huggingface.co/Qwen/Qwen3-8B-GGUF/blob/main/Qwen3-8B-Q4_K_M.gguf (Apache-2.0)
**Runtime:** https://github.com/ggml-org/llama.cpp/releases (MIT)
Zachowaj warunki odpowiednich licencji i informacje o prawach autorskich przy redystrybucji.

## 3. Tryb deweloperski: lokalny model, Spring Boot, Angular

W pierwszym terminalu Git Bash uruchom:

```bash
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/local-ai/run_dev.ps1
```

W drugim:

```bash
cd frontend
npm start
```

W Czat AI możesz teraz pisać do Qwen. Proces na `127.0.0.1:8765` nie udostępnia modelu do sieci LAN; do żądań Spring Boot potrzebny jest tajny klucz sesyjny przekazywany wyłącznie wewnątrz procesu. W aplikacji Electron z właściwie dołączonymi zasobami proces AI i backend startują automatycznie. Jeżeli model jest niedostępny, aplikacja nadal pokazuje pomoc; czat zgłasza błąd, zamiast generować bezsensowne znaki.

## 4. Nowe instrukcje wewnątrz aplikacji

W górnym pasku obok ustawień znajduje się **?**. Kliknij, aby otworzyć pomoc wybranego modułu: Czat, AI Lab, Mining lub Security; z tego samego okna można przejść do pomocy Radia. W AI Lab są dodatkowe przyciski **? Pomoc** przy każdej części: trening, workspace, Offline Brain, Reasoning, Learning, Internet, ranking.

Instrukcje zawierają prawdziwe komendy, przykłady, ograniczenia funkcji i przycisk **Kopiuj**.

### Stary Offline Brain a Qwen

Pole `Token lokalnego API` w Offline Brain **nie jest tokenem Qwen**. Jeśli potrzebujesz eksperymentalnej bazy wiedzy, uruchom osobną usługę:

```bash
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/offline-brain/start.ps1
```

Token usługi na porcie `8766` jest wypisywany w oknie terminala. Wklej go tylko do pola w AI Lab i kliknij `Połącz / odśwież`. **Ten moduł nie jest konieczny, żeby rozmawiać z Qwen**, i trening rankera źródeł nie uczy wag Qwen.

## 5. Testy

```bash
cd ~/Desktop/Nauka/BawarJARVIS-
node --test desktop/electron/local-llm-runtime.test.cjs
python -m unittest discover -s tools/local-ai -p 'test_*.py'
cd backend
./mvnw.cmd test
./mvnw.cmd clean package
cd ../frontend
npm test -- --watch=false
npm run build
npx playwright test e2e/chat-local-llm.e2e.spec.ts e2e/module-context-help.e2e.spec.ts
```

Powyższe komendy w tej kolejności pozwalają zweryfikować kod; **przeszły tu tylko testy Python i Electron**, bo archiwum źródeł użytkownika nie zawiera kompletnej instalacji zależności Angular i Maven, a komputer użytkownika jest Windows + GPU. Brak pełnego testu sprzętowego nie oznacza, że działa pobrane GGUF.

## 6. Test finalnej aplikacji desktopowej

Odbuduj front, JAR oraz instalator Electron, korzystając z dotychczasowych skryptów projektu. Instalator modyfikuje `extraResources` electron-builder, jeżeli wykryje kompatybilne pole `build` w `package.json` lub `desktop/package.json`. Sprawdź, czy spakowane `resources/llm/bin` i `resources/llm/models` faktycznie istnieją. Archiwa powyżej kilku GB mogą wymagać dystrybucji w folderze z odrębnymi plikami zamiast monolitycznego `.exe`.

**To jeszcze nie jest w pełni autonomiczny Jarvis.** Internet Search/RAG, doskonalenie wag modelu, propozycje zmian kodu, testowanie w izolacji i powiadomienia o ukończonym kodzie to kolejne etapy. Ten pakiet dotyczy lokalnego czatu oraz pomocy wewnątrz aplikacji.
