# J.A.R.V.I.S. — 21.4: Voice Assistant V1, stabilizacja

## Zakres

Etap 21.4 zamyka planowane prace funkcjonalne Voice Assistant V1: manualny mikrofon Whisper (21.0), ręczne odczytywanie Piper (21.1), kolejkę i pauzę (21.2), tryb rozmowy Whisper → Qwen → Piper (21.3) oraz diagnostykę i możliwość odzyskania po awarii (21.4).

Wersja V1 nie obejmuje ciągłego nasłuchiwania ani polecenia wybudzającego. Każde nagranie rozpoczyna użytkownik. Nie zapisujemy nagrań w bazie ani nie wysyłamy dźwięku do usług chmurowych. Diagnostyka nie wywołuje endpointów POST ani mikrofonu. Nie wprowadza nowej migracji PostgreSQL ani modeli.

## Instalacja

1. Pobierz `JARVIS_STAGE_21_4_VOICE_V1_FINAL.patch` z odpowiedzi ChatGPT do `~/Downloads/`.
2. Uruchom Git Bash:

```bash
cd ~/Desktop/Nauka/BawarJARVIS-
git apply --check ~/Downloads/JARVIS_STAGE_21_4_VOICE_V1_FINAL.patch && git apply ~/Downloads/JARVIS_STAGE_21_4_VOICE_V1_FINAL.patch
cd frontend
node scripts/install-stage21-4.cjs --check
node scripts/install-stage21-4.cjs
```

Dodatkowa opcja `--check` nie zapisuje zmian. Instalator dopisuje 10 kluczy PL i 10 EN, importuje panel do `ChatVoiceMode`, aktualizuje pamięć statusu Piper i tworzy kopie `.backup-before-stage21-4`. Ponowne uruchomienie nie dubluje zmian. Instalator sprawdza poprzednie wersje przed jakąkolwiek modyfikacją.

## Test automatyczny — jeden blok Git Bash

```bash
cd ~/Desktop/Nauka/BawarJARVIS-/frontend
bash scripts/verify-voice-v1-21-4.sh
```

Skrypt uruchamia testy Node instalatorów 21.0–21.4, `npm run check:i18n`, wszystkie testy Angular, `npm run build`, Playwright dla etapów 21.0–21.4 oraz Java JUnit `LocalSpeechServiceTest,LocalPiperServiceTest`. Kończy się na pierwszym błędzie. Playwright automatycznie uruchamia serwer Angular, jeśli jeszcze nie działa. Realne modele wymagają osobnego testu ręcznego.

Przydatne selektywne polecenia:

```bash
cd ~/Desktop/Nauka/BawarJARVIS-/frontend
node --test scripts/install-stage21-4.test.cjs
npm run check:i18n
npm test -- --watch=false
npm run build
npx playwright test e2e/voice-diagnostics-21-4.e2e.spec.ts e2e/voice-fallback-21-4.e2e.spec.ts
```

## Manualne kryteria odbioru

1. Uruchom serwer PostgreSQL (bez `down -v`) i `npm run dev:web:ai`; sprawdź dostępność Whisper, Qwen i Piper.
2. Otwórz Chat. Kliknij **Sprawdź silniki głosowe**. Upewnij się, że Whisper, Qwen i Piper PL/EN mają status **gotowy**. Jeśli angielski głos nie jest zainstalowany, powinien być oznaczony **niedostępny**, a pozostałe silniki nadal mogą działać.
3. W przypadku niedostępnego Piper (np. brak modelu lub `JARVIS_PIPER_ENABLED=false`) kliknij **Sprawdź silniki głosowe** i sprawdź status niedostępny. Po zainstalowaniu brakującego pliku lub poprawieniu konfiguracji i ponownym uruchomieniu backendu kliknij ponownie — status oraz przycisk **Odczytaj** powinny odzyskać gotowość bez przeładowania Angulara. Piper jest uruchamiany jako proces CLI do syntezy, a nie jako stale działający serwer.
4. Z wyłączonym trybem rozmowy nagraj zdanie i zatrzymaj mikrofon: tekst pojawia się w polu Chat, nie jest wysłany automatycznie.
5. Włącz tryb rozmowy, nagraj zdanie: Whisper → pojedyncze wysłanie Chat do Qwen → odpowiedź → Piper. Sprawdź pauzę, wznowienie, zatrzymanie.
6. Odłącz Qwen i ponów wypowiedź: nie powinna zostać wysłana ponownie automatycznie; rozpoznany tekst pozostaje w polu Chat do decyzji użytkownika.
7. W czasie syntezy lub generowania przejdź do Mining albo zmień rozmowę: odtwarzanie nie powinno się wznowić po powrocie.
8. Sprawdź interfejs PL/EN, focus klawiatury i błędy przeglądarki.

Uwaga: przycisk **Przerwij głos** nie cofa operacji, które backend już zaakceptował. Wersja V1 nie gwarantuje przerwania uruchomionego generowania Qwen po stronie serwera. Diagnostyka mierzy dostępność endpointów, **nie czas inferencji** Whisper/Qwen/Piper.

## Pliki dodane — ścieżki względem `BawarJARVIS-`

| Plik | Cel |
|---|---|
| `frontend/src/app/core/services/voice-pipeline-diagnostics.ts` | Ręczna diagnostyka lokalnych silników, timeout 5 s na sprawdzenie |
| `frontend/src/app/core/services/voice-pipeline-diagnostics.spec.ts` | Test gotowości, awarii, recovery, współbieżności i limitu czasu |
| `frontend/src/app/core/services/local-tts-player-recovery.spec.ts` | Test wymuszonego odświeżania statusu Piper |
| `frontend/src/app/features/chat/voice-diagnostics/voice-diagnostics.ts` | Angular: panel diagnostyki |
| `frontend/src/app/features/chat/voice-diagnostics/voice-diagnostics.html` | Widok statusów PL/EN |
| `frontend/src/app/features/chat/voice-diagnostics/voice-diagnostics.scss` | Style panelu poza ChatView |
| `frontend/src/app/features/chat/voice-diagnostics/voice-diagnostics.spec.ts` | Test świadomego uruchomienia diagnostyki |
| `frontend/e2e/voice-diagnostics-21-4.e2e.spec.ts` | E2E: offline Piper, powrót do działania bez ponownego uruchomienia |
| `frontend/e2e/voice-fallback-21-4.e2e.spec.ts` | E2E: awaria Qwen, pojedynczy POST i zachowany szkic |
| `frontend/scripts/install-stage21-4.cjs` | Instalator integracyjny, `--check`, backup i idempotencja |
| `frontend/scripts/install-stage21-4.test.cjs` | Testy instalatora |
| `frontend/scripts/verify-voice-v1-21-4.sh` | Jedna komenda testów regresyjnych dla całego modułu |
| `frontend/docs/STAGE_21_4_VOICE_V1_FINAL.md` | Niniejsza instrukcja |

## Pliki modyfikowane przez instalator

- `frontend/src/app/core/services/local-tts-player.ts`: `checkAvailability(force = false)` — zapamiętanie statusu do czasu wymuszenia odświeżenia, współdzielenie równoległych żądań, brak trwałego blokowania ponownej próby.
- `frontend/src/app/core/services/voice-conversation.ts`: odświeżenie statusu Piper przed odczytaniem nowej odpowiedzi.
- `frontend/src/app/features/chat/chat-voice-mode/chat-voice-mode.ts`: import komponentu diagnostyki.
- `frontend/src/app/features/chat/chat-voice-mode/chat-voice-mode.html`: przycisk i status czterech możliwości (Whisper, Qwen, Piper PL/EN).
- `frontend/public/i18n/pl.json` i `frontend/public/i18n/en.json`: po 10 kluczy `voice.health.*`.

Nie zmieniamy Java, Docker, modeli, migracji DB, historii czatu, ustawień `ChatStore`, ani kodu instalatora Electrona.

## Warunki uznania V1 za zakończony

Zakres kodowy jest przygotowany, ale **moduł nie jest ostatecznie odebrany**, dopóki pełny test automatyczny i realny test mikrofonu, Qwen i Piper na Windows nie przejdą pomyślnie. Testy ze sztucznymi odpowiedziami nie dowodzą poprawnej instalacji plików modelowych ani sterowników mikrofonu.
