# J.A.R.V.I.S. 21.2 — lokalna kolejka głosu Piper

## Zakres

- Odpowiedź Chat do 12 000 znaków (UTF-16) jest dzielona po stronie Angulara na części maksymalnie 650 znaków.
- Backend Piper pozostaje bez zmian: nadal akceptuje maksymalnie 1200 znaków na żądanie.
- Fragmenty są syntezowane **sekwencyjnie**, wyłącznie po kliknięciu użytkownika. Następny jest generowany po zakończeniu poprzedniego.
- Pauza, wznowienie, przerwanie oraz licznik fragmentów.
- Wstrzymanie w trakcie przygotowywania fragmentu nie uruchamia go samoczynnie.
- Zmiana modułu, zniknięcie wiadomości, ukrycie strony lub Stop zwalnia obiekt WAV, zatrzymuje odtwarzanie i unieważnia wynik zaległego żądania.
- Żaden plik nie trafia do PostgreSQL ani localStorage. Nadal używamy lokalnego Piper i modeli 21.1.

## Pliki (ścieżki względem BawarJARVIS-)

- `frontend/src/app/core/utils/tts-text-chunks.ts` — algorytm dzielenia tekstu.
- `frontend/src/app/core/utils/tts-text-chunks.spec.ts` — testy algorytmu.
- `frontend/src/app/core/services/local-tts-player.ts` — jedna kolejka głosowa, pauza/wznowienie.
- `frontend/src/app/core/services/local-tts-player-queue.spec.ts` — testy kolejki, wyścigów i anulowania.
- `frontend/src/app/features/chat/chat-speech/chat-speech.ts` — sterowanie, cleanup.
- `frontend/src/app/features/chat/chat-speech/chat-speech.html` — przyciski i licznik.
- `frontend/src/app/features/chat/chat-speech/chat-speech.scss` — styl licznika.
- `frontend/e2e/voice-queue-21-2.e2e.spec.ts` — test Playwright.
- `frontend/scripts/install-stage21-2.cjs` — idempotentne dopisanie kluczy PL/EN.
- `frontend/scripts/install-stage21-2.test.cjs` — test instalatora i odmowy zmian przy niepoprawnej bazie.
- `frontend/docs/STAGE_21_2_VOICE_PLAYBACK.md` — ten dokument.

## Instalacja i testy (Git Bash)

```bash
cd ~/Desktop/Nauka/BawarJARVIS-
git apply --check ~/Downloads/JARVIS_STAGE_21_2_VOICE_QUEUE.patch && git apply ~/Downloads/JARVIS_STAGE_21_2_VOICE_QUEUE.patch
cd frontend
node scripts/install-stage21-2.cjs
node --test scripts/install-stage21-2.test.cjs
npm run check:i18n
npm test -- --watch=false
npm run build
npx playwright test e2e/voice-queue-21-2.e2e.spec.ts e2e/voice-read-aloud-21-1.e2e.spec.ts
```

**Wymagania:** zaaplikowany etap 21.1 wraz z poprawką TS4114 z etapu 21.1.1, Piper uruchomiony i `JARVIS_PIPER_ENABLED=true` w istniejącym `backend/.env.jarvis` dla testów ręcznych. Nie trzeba pobierać nowych modeli.

## Test ręczny

1. Uruchom `npm run dev:web:ai` z `frontend` i otwórz Chat.
2. Wybierz odpowiedź asystenta dłuższą niż 650 znaków, kliknij „Odczytaj na głos”.
3. Sprawdź licznik „Fragment 1 / N”, przycisk „Pauza” i „Wznów”.
4. Zatrzymaj odczyt albo przejdź do innego modułu — synteza nie może uruchamiać kolejnych fragmentów.
5. Spróbuj ponownie odczytać inną odpowiedź, aby sprawdzić przełączenie aktywnej wiadomości.

**Ograniczenie V1:** między fragmentami może występować krótka przerwa, ponieważ kolejny WAV powstaje dopiero po zakończeniu poprzedniego. Nie jest to strumieniowe TTS. Przed odtworzeniem przeglądarka może wymagać ponownego kliknięcia, jeśli ogranicza autoplay po asynchronicznym żądaniu.
