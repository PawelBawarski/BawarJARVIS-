# J.A.R.V.I.S. 21.1 — Local TTS with Piper

## Scope

Manual **Read aloud** for assistant messages in Chat; Polish Gosia and English Amy models. No auto-play, no cloud synthesis, no database audio storage. One active player across all messages. Audio stops on navigation away from Chat. A second click is offered if browser autoplay policy blocks playback after asynchronous audio generation.

This is the V1 TTS implementation. Answers longer than 1,200 characters are not synthesized yet. No speech streaming or lip sync.

## New files relative to `BawarJARVIS-`

- `backend/src/main/java/pl/bawar/jarvis/voice/LocalPiperService.java`
- `backend/src/main/java/pl/bawar/jarvis/voice/LocalTtsController.java`
- `backend/src/test/java/pl/bawar/jarvis/voice/LocalPiperServiceTest.java`
- `frontend/src/app/core/services/local-tts-api.ts`
- `frontend/src/app/core/services/local-tts-api.spec.ts`
- `frontend/src/app/core/services/local-tts-player.ts`
- `frontend/src/app/core/services/local-tts-player.spec.ts`
- `frontend/src/app/features/chat/chat-speech/chat-speech.ts`
- `frontend/src/app/features/chat/chat-speech/chat-speech.html`
- `frontend/src/app/features/chat/chat-speech/chat-speech.scss`
- `frontend/src/app/features/chat/chat-speech/chat-speech.spec.ts`
- `frontend/e2e/voice-read-aloud-21-1.e2e.spec.ts`
- `frontend/scripts/install-stage21-1.cjs`
- `frontend/scripts/install-stage21-1.test.cjs`
- `frontend/scripts/setup-piper-21-1.sh`
- `frontend/docs/STAGE_21_1_LOCAL_PIPER.md`

## Installation (Windows 11, Git Bash)

```bash
cd ~/Desktop/Nauka/BawarJARVIS-
git apply --check ~/Downloads/JARVIS_STAGE_21_1_LOCAL_PIPER.patch && \
  git apply ~/Downloads/JARVIS_STAGE_21_1_LOCAL_PIPER.patch
cd frontend
node scripts/install-stage21-1.cjs
bash scripts/setup-piper-21-1.sh
```

Download by script goes to `~/JarvisAI/piper/piper.exe` and `~/JarvisAI/models/*.onnx` with configs. `piper_windows_amd64.zip` is the fixed 2023.11.14-2 official Windows release; the ONNX files are verified against SHA256 from Hugging Face. The archive is downloaded over HTTPS and checked for integrity as a ZIP during extraction, but the script does **not** have a pinned ZIP digest; see the upstream release if stronger supply-chain attestation is required. Running the script opts into `JARVIS_PIPER_ENABLED=true` in `backend/.env.jarvis` only if absent; check existing values first.

The installer modifies with backups:

- `frontend/src/app/features/chat/chat-view/chat-view.ts`
- `frontend/src/app/features/chat/chat-view/chat-view.html`
- `frontend/scripts/dev-stack.cjs`
- `frontend/public/i18n/pl.json`
- `frontend/public/i18n/en.json`

Do not commit `.env.jarvis` or ONNX files to Git.

## Validation

```bash
cd ~/Desktop/Nauka/BawarJARVIS-/frontend
node --test scripts/install-stage21-1.test.cjs
npm run check:i18n
npm test -- --watch=false
npm run build
npx playwright test e2e/voice-read-aloud-21-1.e2e.spec.ts e2e/voice-dictation-21-0.e2e.spec.ts

cd ../backend
./mvnw.cmd -Dtest=LocalPiperServiceTest,LocalSpeechServiceTest test
```

## Startup

```bash
cd ~/Desktop/Nauka/BawarJARVIS-/backend
docker compose --env-file .env.jarvis -f compose.db.yml up -d
cd ../frontend
npm run dev:web:ai
```

Use Chat → a J.A.R.V.I.S. reply → **Odczytaj na głos**. The text goes to Spring Boot, is synthesized using local `piper.exe`, WAV returned as a binary response, and played in the browser. The only disk file is temporary and deleted after synthesis. **Stop voice** halts playback; switching away from Chat also stops it.

The `21.1` request is limited to 1,200 characters; invalid/too-long and unconfigured requests are rejected before launching Piper. The backend doesn't run text through a shell, and the native process receives a reduced environment with no DB or model API secrets. All endpoints remain protected by the existing `ROLE_JARVIS` access policy.
