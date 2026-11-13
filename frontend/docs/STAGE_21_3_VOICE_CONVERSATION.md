# Stage 21.3 — Voice Conversation (opt-in, one turn per microphone click)

## Scope

- Chat stays **manual by default**. The 21.0 dictation path still fills the input without sending it.
- User must click **Włącz rozmowę głosową / Enable voice conversation** to enable STT → Qwen → Piper for the current Chat view.
- After opt-in, user clicks the microphone, records up to 15 seconds and clicks Stop. The existing Whisper endpoint returns a transcript. The transcript is sent exactly once through the existing authenticated ChatStore, and the latest assistant message is read aloud by the 21.2 Piper queue.
- There is **no always-on microphone**, no background listening, no cloud API, no database migration, and no new model to download.
- Playback can be paused/resumed with the existing buttons **on the assistant message**, stopped with the Voice Conversation Stop button, or disabled completely with the mode toggle.
- Switching chats, leaving Chat, disabling voice, or destroying ChatView prevents late Qwen responses from being narrated.
- A message already sent to Spring Boot **cannot be unsent**; Stop only prevents further playback. A Qwen request may finish server-side.
- If the model send fails, ChatView restores the transcript to the input. If Piper is unavailable, the reply remains in the chat and only audio is skipped.
- The backend enforces the existing 1,200-character Piper request limit; 21.2 splits text into 650-character parts (maximum overall 12,000).

## Files (relative to BawarJARVIS-)

| Path | Purpose |
|---|---|
| `frontend/src/app/core/services/voice-conversation.ts` | One-turn orchestrator, explicit consent, cancellation guards |
| `frontend/src/app/core/services/voice-conversation.spec.ts` | Opt-in, failure, stop, navigation and concurrency unit tests |
| `frontend/src/app/features/chat/chat-view/chat-view.ts` | Connects microphone transcript to orchestrator when opt-in |
| `frontend/src/app/features/chat/chat-view/chat-view.html` | Renders opt-in controls and unchanged recorder |
| `frontend/src/app/features/chat/chat-voice/chat-voice.ts` | Adds read-only `autoSend` input for the privacy notice |
| `frontend/src/app/features/chat/chat-voice/chat-voice.html` | Displays different notices for manual / auto-send mode |
| `frontend/src/app/features/chat/chat-voice-mode/chat-voice-mode.ts` | Standalone PL/EN conversation mode control |
| `frontend/src/app/features/chat/chat-voice-mode/chat-voice-mode.html` | Enable/disable/stop/status UI |
| `frontend/src/app/features/chat/chat-voice-mode/chat-voice-mode.scss` | Isolated accessible styles, preserves ChatView style budget |
| `frontend/src/app/features/chat/chat-voice-mode/chat-voice-mode.spec.ts` | Mode control unit test |
| `frontend/e2e/voice-conversation-21-3.e2e.spec.ts` | Simulated STT → Chat → Piper Playwright E2E |
| `frontend/scripts/install-stage21-3.cjs` | Installs 17 translation keys in both dictionaries without overwrite |
| `frontend/scripts/install-stage21-3.test.cjs` | Installer repeatability, missing prerequisites tests |
| `frontend/docs/STAGE_21_3_VOICE_CONVERSATION.md` | This documentation |

## Install

Download the patch attachment to `~/Downloads`, then run in Git Bash:

```bash
cd ~/Desktop/Nauka/BawarJARVIS-
git apply --check ~/Downloads/JARVIS_STAGE_21_3_VOICE_CONVERSATION.patch && git apply ~/Downloads/JARVIS_STAGE_21_3_VOICE_CONVERSATION.patch
cd frontend
node scripts/install-stage21-3.cjs
```

This patch requires 21.0, 21.1, 21.2. The earlier 21.2.1 TestBed.tick() correction is recommended independently.

## Tests

```bash
cd ~/Desktop/Nauka/BawarJARVIS-/frontend
node --test scripts/install-stage21-3.test.cjs
npm run check:i18n
npm test -- --watch=false
npm run build
npx playwright test e2e/voice-conversation-21-3.e2e.spec.ts e2e/voice-queue-21-2.e2e.spec.ts e2e/voice-dictation-21-0.e2e.spec.ts
```

Backend regression (no Java changes in this stage):

```bash
cd ~/Desktop/Nauka/BawarJARVIS-/backend
./mvnw.cmd -Dtest=LocalSpeechServiceTest,LocalPiperServiceTest test
```

## Run and manually verify

```bash
cd ~/Desktop/Nauka/BawarJARVIS-/frontend
npm run dev:web:ai
```

Open `/chat`, confirm manual mode is off, record a short phrase and verify it only fills the input. Enable voice conversation, click the microphone, record/stop, confirm the Chat message is posted once and the Piper readout starts. Pause/resume on the assistant reply; use voice Stop and then Disable. Switch to another Chat or module while Qwen is generating and confirm no late audio plays. For recognition and synthesis, the previously installed `whisper-cli` and `piper.exe` must be configured in `backend/.env.jarvis`.
