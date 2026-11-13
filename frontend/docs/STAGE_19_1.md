# J.A.R.V.I.S. 19.1 — web-controlled file writes and rollback

## Scope

Adds a **separate, opt-in Spring Boot file-write workflow** for AI Lab previews. This does not
reactivate Electron or its native bridge. It does not execute model-generated code.

The original content in the AI Lab diff **must equal the entire existing disk file byte-for-byte**
(UTF-8, max 16 KiB). A 3600-character excerpt from a larger file is **not writable** and returns
`FILE_CHANGED`. This intentionally prevents accidentally replacing a whole file with a snippet.

### Default: DISABLED

The API will refuse writes unless these two settings are explicitly configured:

```ini
# BawarJARVIS-/backend/.env.jarvis   (not committed to Git)
JARVIS_AGENT_FILE_WRITES_ENABLED=true
JARVIS_AGENT_WORKSPACE_ROOT=C:/Users/USER/Desktop/Nauka/BawarJARVIS-
```

The integration script extends `frontend/scripts/dev-stack.cjs` to read these keys from `.env.jarvis`.
Set a **real, absolute, existing directory**. Restart `npm run dev:web:ai` after any settings change.
Use an isolated development checkout, not a sensitive system or personal document directory.

## Protections

- Spring Security `ROLE_JARVIS` remains mandatory; requests use the existing local auth proxy.
- The server, not browser, determines the one authorized workspace root.
- Allowed path segments/file extensions follow existing `AgentSourceContext.validPath()`.
- No new files, symlinks, `.env` files, or directories may be written.
- `prepare` validates byte-for-byte equality against the existing full file and returns
  a **one-use 5-minute ticket** bound to source, replacement, and path.
- A separate explicit UI confirmation issues `apply`. POST calls are never automatically retried.
- A backup is persisted outside the workspace to `~/.jarvis/agent-backups`, enabling rollback
  after server restart. Backup records are workspace-bound.
- Rollback refuses to overwrite subsequent edits; a SHA-256 match to the applied version is mandatory.
- Replacements use same-directory temporary files and atomic moves (fail closed if unsupported).
- There is **no test-runner/sandbox execution** in this stage. A generated diff is not a security audit.

**Limitations:** Externally concurrent file writes can race between verification and rename;
filesystems not supporting atomic moves are rejected. On Windows the target can inherit directory
ACLs after atomic replacement; check permissions for sensitive projects. Backup records are stored
under the local user's home and must be protected by OS account permissions. Avoid live production
workspaces. Keep Git commits as a second recovery mechanism.

## Install from repository root

```bash
cd ~/Desktop/Nauka/BawarJARVIS-
git apply --check ~/Downloads/JARVIS_STAGE_19_1_WEB_SAFE_WRITE.patch && \
  git apply ~/Downloads/JARVIS_STAGE_19_1_WEB_SAFE_WRITE.patch

cd frontend
node scripts/install-stage19-1.cjs
```

The installer modifies the existing `frontend/src/app/features/ai-lab/agent-planner/agent-planner.ts`,
`frontend/src/app/features/ai-lab/agent-planner/agent-planner.html`, `frontend/public/i18n/pl.json`,
`frontend/public/i18n/en.json`, and `frontend/scripts/dev-stack.cjs`, **after validating all anchors**.
It backs them up using `.backup-before-stage-19-1` suffix and is safe to run twice. It supports the
existing frontend from stage 18.9 and the stage 19.0 code review additions without replacing either.

## Tests

```bash
cd ~/Desktop/Nauka/BawarJARVIS-/frontend
node --test scripts/install-stage19-1.test.cjs
npm run check:i18n
npm test -- --watch=false
npm run build
npx playwright test e2e/agent-controlled-file-19-1.e2e.spec.ts

cd ../backend
./mvnw.cmd -Dtest=AgentControlledFileServiceTest test
```

Ensure a full production build and all existing Playwright tests pass before enabling file writes.

## New paths (all relative to `BawarJARVIS-`)

- `backend/src/main/java/pl/bawar/jarvis/agent/AgentControlledFileService.java`
- `backend/src/main/java/pl/bawar/jarvis/agent/AgentControlledFileController.java`
- `backend/src/main/java/pl/bawar/jarvis/agent/AgentControlledFileErrorHandler.java`
- `backend/src/test/java/pl/bawar/jarvis/agent/AgentControlledFileServiceTest.java`
- `frontend/src/app/core/services/agent-file-write-api.ts`
- `frontend/src/app/features/ai-lab/agent-file-write/agent-file-write.ts`
- `frontend/src/app/features/ai-lab/agent-file-write/agent-file-write.html`
- `frontend/src/app/features/ai-lab/agent-file-write/agent-file-write.scss`
- `frontend/src/app/features/ai-lab/agent-file-write/agent-file-write.spec.ts`
- `frontend/e2e/agent-controlled-file-19-1.e2e.spec.ts`
- `frontend/scripts/install-stage19-1.cjs`
- `frontend/scripts/install-stage19-1.test.cjs`
- `frontend/docs/STAGE_19_1.md`

The stage has two phases: deployment of the disabled capability, then optional manual activation.
Do not configure the second phase until you have tested the first phase.
