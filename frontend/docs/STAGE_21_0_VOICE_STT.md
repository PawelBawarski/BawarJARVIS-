# J.A.R.V.I.S. 21.0 — Voice Assistant: local dictation

## Scope

- Angular 22: microphone starts only after explicit user action. Audio is processed locally by Web Audio API, converted to PCM16 mono 16 kHz WAV, limited to 15 seconds.
- Spring Boot: authenticated `/api/ai-lab/voice/status` and `/api/ai-lab/voice/transcribe` (multipart POST). No recording is persisted, no external speech API, no auto-send to Qwen.
- Whisper CLI: local, user-installed `whisper-cli.exe` and multilingual `ggml-base.bin`, configured through `backend/.env.jarvis`. Disabled by default.
- If successful, recognized text is inserted into the existing Chat input. User still needs to click Send.
- Browser requires permission to access a microphone; Chrome/Firefox require a secure origin (localhost is acceptable).

## Installation: Git Bash on Windows 11

1. Apply the supplied `JARVIS_STAGE_21_0_LOCAL_STT.patch` and run:

```bash
cd ~/Desktop/Nauka/BawarJARVIS-/frontend
node scripts/install-stage21-0.cjs
bash scripts/setup-whisper-21-0.sh
```

The setup downloads official Windows CPU binary from whisper.cpp `b5454` (v1.9.5) and multilingual `ggml-base.bin`, verifies both SHA-256 checksums, then adds missing settings to `backend/.env.jarvis` (existing settings remain unchanged).

2. Make sure `JARVIS_VOICE_ENABLED=true` and both paths point to existing files. Settings are intentionally not committed to Git:

```ini
JARVIS_VOICE_ENABLED=true
JARVIS_WHISPER_CLI_PATH=C:/Users/bawar/JarvisAI/whisper/whisper-cli.exe
JARVIS_WHISPER_MODEL_PATH=C:/Users/bawar/JarvisAI/models/ggml-base.bin
```

3. Start PostgreSQL before the stack:

```bash
cd ~/Desktop/Nauka/BawarJARVIS-/backend
docker compose --env-file .env.jarvis -f compose.db.yml up -d
cd ../frontend
npm run dev:web:ai
```

## Tests

```bash
cd ~/Desktop/Nauka/BawarJARVIS-/frontend
node --test scripts/install-stage21-0.test.cjs
npm run check:i18n
npm test -- --watch=false
npm run build
npx playwright test e2e/voice-dictation-21-0.e2e.spec.ts
cd ../backend
./mvnw.cmd -Dtest=LocalSpeechServiceTest test
```

## Security and limitations

- The recordings are temporarily written by the Spring Boot process under system temp and deleted after processing. Error logs deliberately do not include voice content.
- No audio uploads to third-party services. The only downloaded resources are Whisper binary and multilingual model at installation time.
- 16 kHz mono PCM16 WAV only; at least 0.2 seconds, at most 15 seconds; 70-second CLI timeout; a single concurrent transcription. Process environment is stripped of DB tokens.
- Microphone is stopped when the Chat tab is left, page is hidden, or Chat component is destroyed.
- Browser-side `createScriptProcessor` is deprecated but works in supported browsers; an AudioWorklet replacement is planned after the initial release.
- Status "configured" means files/settings are present, not that speech-to-text accuracy or CLI execution has been confirmed.
- This first voice stage is **speech-to-text only**. Local text-to-speech using Piper is a separate next step, not simulated via cloud Web Speech services.

## Exact repo paths

- `backend/src/main/java/pl/bawar/jarvis/voice/LocalSpeechService.java`
- `backend/src/main/java/pl/bawar/jarvis/voice/LocalVoiceController.java`
- `backend/src/test/java/pl/bawar/jarvis/voice/LocalSpeechServiceTest.java`
- `frontend/src/app/core/services/voice-api.ts`
- `frontend/src/app/core/services/voice-api.spec.ts`
- `frontend/src/app/features/chat/chat-voice/chat-voice.ts`
- `frontend/src/app/features/chat/chat-voice/chat-voice.html`
- `frontend/src/app/features/chat/chat-voice/chat-voice.scss`
- `frontend/src/app/features/chat/chat-voice/chat-voice.spec.ts`
- `frontend/src/app/features/chat/chat-voice/pcm-wave.ts`
- `frontend/src/app/features/chat/chat-voice/pcm-wave.spec.ts`
- `frontend/e2e/voice-dictation-21-0.e2e.spec.ts`
- `frontend/scripts/install-stage21-0.cjs`
- `frontend/scripts/install-stage21-0.test.cjs`
- `frontend/scripts/setup-whisper-21-0.sh`
- `frontend/docs/STAGE_21_0_VOICE_STT.md`

Integrator modifies existing `frontend/src/app/features/chat/chat-view/chat-view.ts`, `chat-view.html`, `frontend/scripts/dev-stack.cjs`, and `frontend/public/i18n/{pl,en}.json` after creating per-file backups. It does not modify Maven dependencies, database migrations, or chat storage.
