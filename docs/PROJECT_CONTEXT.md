# J.A.R.V.I.S. — PROJECT CONTEXT / HANDOFF

> This is a **structured handoff**, updated on 2026-11-11 with repository inspection and the 17.6.10 verification session. It is not a verbatim export of every chat. Verify names, versions, source paths and implementations against the local repository. The local Git working tree is the ultimate source of truth; detailed current evidence and pending work are in `docs/CURRENT_STATUS.md`.

## 1. Mission and product direction

The owner is building J.A.R.V.I.S., a personal Windows desktop AI assistant, in a staged, educational, production-oriented project. It should eventually support chats, offline/local inference, voice output, workspace/code analysis and an agent capable of safely proposing code changes. User controls changes; unsafe arbitrary command execution and self-modification without approval are out of scope.

Intended product quality: maintainability, automated tests, privacy, data retention and a Windows installer with reliable upgrades/auto-update. Long-term goal includes a polished distributable application. Commercial release is **not approved** by a build or static audit alone.

## 2. Main technology stack

| Layer | Intended/observed stack |
| --- | --- |
| UI | Angular 22, TypeScript, SCSS, Signals/RxJS, standalone components |
| Desktop | Electron, Node.js, NSIS via electron-builder, `electron-updater` / GitHub releases |
| Backend | Java 21, Spring Boot, REST API, Maven/JUnit |
| Persistence | Managed, locally packaged PostgreSQL 17 and Flyway |
| Chat AI | llama.cpp, Qwen3-8B-GGUF Q4_K_M (model provisioning requires consent; installer excludes GGUF) |
| Own Java AI | TinyGpt/Transformer, tokenizer, training, AdamW and checkpoints in `backend/src/main/java/pl/bawar/jarvis/brain/`; experimental AI Lab path |
| Testing | Angular/Vitest unit tests, Playwright E2E, `node --test`, Maven/JUnit with H2, Python release-tool tests |
| Languages | Polish default, English optional; translation JSON and translation pipe |
| OS/dev | Windows 11, Git Bash, VS Code / other IDE; Node 26.13.0 was reported |

Current desktop version: `jarvis-desktop@1.0.3`. Source metadata declares Angular 22.2.x, TypeScript 6.0.x, Vitest 5 and Spring Boot 4.1.2 / Java 21. Read package metadata and lockfiles for exact versions. The current chat uses Qwen through a private loopback llama.cpp server; this does not replace the long-term goal of the project's own Java LLM.

## 3. Product design / requirements

- Modular frontend, each component in separate `.ts`, `.html`, `.scss`, `.spec.ts` files. Avoid root app files as feature containers.
- Responsive UI, persistent burger access at narrow widths, dynamic module registry and arrows/navigation that work when modules grow.
- Current navigation has **three tabs**: Chat (`chat`), AI Lab (`lab`), Security (`security`). **Radio is a toolbar panel**, not a fourth tab. The Release Gate scenario named `four_modules` must assess the four product functions, including toolbar Radio, without asserting four select options. Bitcoin/Mining remains removed.
- Chat includes conversation history, deletions with **custom Angular confirmation dialog** instead of native `window.confirm`, backend DB persistence and test coverage.
- Security tab is a diagnostic view; actual defenses live in Electron main process and Java backend.
- PL/EN translation infrastructure exists. Some newer AI Lab/help text is still hardcoded in Polish; complete localization remains unfinished. New UI should use the existing translation pipe/JSON.
- Separate dark/light mode.
- No `localStorage` for final persistent chat data; backend API and PostgreSQL hold durable state.
- Voice and other ambitious modules are future enhancements, not evidence of completed behavior.

## 4. AI Lab and agent direction

The historical 12.4 workspace selection/inspection API remains read-only. Later, separate 16.x modules already exist in the repository:

- 16.0 proposal generation, persistence and human decisions;
- 16.2 explicitly reviewed source excerpts supplied to the planner;
- 16.3 read-only patch preview;
- 16.4 isolated syntax checks;
- 16.5 opt-in project tests in a disposable Docker copy, without network access;
- 16.6 single-fragment deployment with a test grant, source hashes, native confirmation, backup and rollback.

Relevant entry points are `desktop/electron/agent-proposal-ipc.cjs`, `desktop/electron/agent-sandbox-check.cjs`, `desktop/electron/agent-project-test.cjs` and `desktop/electron/agent-workspace-apply.cjs`. The Java proposal service does not write source files. These existing capabilities do not authorize new filesystem access or arbitrary commands. Preserve path traversal and symlink/junction defenses, IPC allowlists, least privilege and explicit approval. Some AI Lab descriptions still describe already existing functions as future work; do not infer implementation status from UI text alone.

## 5. Packaging and stage evolution

Recent development focused on stages 17.3–17.6:

- Stage 17.3: managed packaged PostgreSQL runtime and migration-only safety.
- Stage 17.4: staged llama.cpp and Qwen runtime resources; manifest and integrity checks. `electron-builder.stage17-4.config.cjs` enforces **one** map of `desktop/ai-runtime` to `llm`.
- Stage 17.5: smaller NSIS installer excludes multi-GB GGUF and personal data. Config chain: `electron-builder.stage17-5.desktop.config.cjs` -> `electron-builder.stage17-5.config.cjs` -> 17.4 -> 17.3. The desktop adapter normalizes source paths to the desktop project root.
- Stage 17.6.1: first-run PostgreSQL bootstrap (`desktop/electron/postgres-first-run.cjs`) with `initdb`, private ACLs, `backend.env` and a state file.
- Stage 17.6.2: Qwen model provisioning with consent, hash checking/cancellation (verify actual behavior and tests).
- Stage 17.6.3: static release gate plus manual Windows checklist and installed-dir verification.
- Stage 17.6.6–17.6.9: repaired `postgres-runtime.cjs` error handling, discovered Windows folder name ending in period causes `icacls.exe` path errors, began switching database storage to `JarvisData`; adjusted fixtures.
- Stage 17.6.10: consistent JarvisData paths and backend fixtures; awaited PostgreSQL/Qwen/backend startup and shutdown; no late process spawn after cancellation; owned Java termination precedes database shutdown. `desktop/electron/runtime-lifecycle.cjs` coordinates these operations and `desktop/electron/main.cjs` enforces a packaged-app single-instance lock.
- Windows PostgreSQL control now uses `desktop/electron/postgres-process.cjs`: bounded `spawn` with `shell: false` and ignored stdio, avoiding inherited descendant pipe handles. Cleanup after a failed start requires cluster/PID identity and a CIM-confirmed `pg_ctl -> cmd.exe -> postgres.exe` ancestry; process ownership is not inferred from a port or PID alone.
- Bootstrap makes the JarvisData application directory private before writing `backend.env`, and persists protected recovery credentials before starting native initialization. Partial clusters still fail closed; these changes do not repair an existing partial user cluster automatically.

Packaging rules:
- Preserve stable `appId`, product name `J.A.R.V.I.S.`, user data retention and update compatibility.
- The sole `llm` extraResources mapping must not be duplicated. Base `desktop/electron-builder.config.cjs` originally had an extra `resources/llm` mapping which was removed to avoid a Stage 17.4 conflict.
- Source license files are in `desktop/resources/llm`. `scripts/stage-llm-licenses.cjs` stages all three notices into `desktop/ai-runtime/licenses/`, packaged as `resources/llm/licenses/` to match the original Release Gate. Stage 17.5 explicitly includes this tree in its LLM `filter`.
- `desktop/package.json` provides `installer:stage17-5`: build UI, stage licenses, build NSIS with the desktop adapter, then run `scripts/verify-release-artifact.cjs --write-manifest`. `verify:artifact` runs static verification without rebuilding.
- The verifier checks required resources, source/artifact hashes, all production Electron modules including nested directories in `app.asar`, forbidden data/backups/GGUF and the license tree. It writes `dist/jarvis-17-5/stage17-5-build.json` with `github_release_upload_ready: false`; static success is never publication approval.
- `backend/pom.xml` excludes `**/*.bak` and `**/*.backup*` from production resources. A previously copied backup can remain in an old `backend/target/classes/`; verify the actual new JAR rather than relying on the exclusion alone.
- `.github/workflows/frontend-tests.yml` includes unit tests followed by Playwright Chromium. `.github/workflows/windows-installer.yml` stages the full runtime/build path and verifies the artifact; publication remains blocked until an independently reviewed manual gate approves the same artifact and its signature is valid.
- The original Stage 17.6.3 auditor is a user-local downloaded tool, not a repository dependency: `~/Downloads/jarvis_release_gate_17_6_3.py`. Its current run still blocks on the old installed directory and pending manual evidence; do not replace it with an easier custom gate.

## 6. Path conventions / data ownership

### Previously used path (legacy / may be partly initialized)

`%APPDATA%\J.A.R.V.I.S.\` — Electron-associated user data path, and formerly `backend.env`/`postgres17`.

Windows native `icacls.exe` reported that `J.A.R.V.I.S.` and its child `postgres17` were not found, despite Node.js `lstatSync()` seeing them. A trailing dot is not a safe Win32 folder naming convention; this motivated a separate technical DB data folder.

### Current database path

`%APPDATA%\JarvisData\backend.env`

`%APPDATA%\JarvisData\postgres17\data\PG_VERSION`

`%APPDATA%\JarvisData\postgres17\state.json`

`%APPDATA%\JarvisData\postgres17\credentials.json`

Affected modules were changed to target `JarvisData`:
- `desktop/electron/postgres-first-run.cjs`
- `desktop/electron/postgres-runtime.cjs`
- `desktop/electron/backend-runtime.cjs`

**Do not rename the entire Electron userData folder or Qwen model folder inadvertently.** Model paths are in `%LOCALAPPDATA%\J.A.R.V.I.S.\models`, separate from PostgreSQL storage.

### Critical migration caveat

A legacy `%APPDATA%\J.A.R.V.I.S.\backend.env` existed; the user attempted a rename/backup but logs later showed it missing. Legacy data may still be present in Docker or elsewhere; no completed migration of old chat history was verified. Do not clean up, delete, rewrite or migrate legacy user data automatically. Any migration requires explicit consent and a backup/restore plan.

Read-only inspection during 17.6.10 found an existing **partial** `%APPDATA%\JarvisData\postgres17\data` with `PG_VERSION=17`, without `backend.env`, `state.json` or `credentials.json`; the application database port 55432 is in use. That cluster, its process, the legacy directory, model and private configuration were left untouched. The existing installed application was not upgraded by this session. Recovery needs informed consent, verified offline backup and an explicit restore plan; never reinitialize, invent credentials, remove PID files or stop a process merely because it uses the application port.

## 7. Tests and policies

Every frontend feature change must have Vitest tests **and** Playwright E2E. Every Electron/back-end change requires relevant Node/JUnit tests. The user values clear exact file paths, controlled staging and repeatability.

A successful Node test with mocked `fs`/process execution does **not** prove a successful `icacls`, `initdb`, `Flyway`, Windows installation or runtime database connectivity. The release auditor requires separate tests on an isolated Windows account / VM.

Maven tests use in-memory H2 from `backend/src/test/resources/application.properties`; they are not real PostgreSQL integration tests. Most Playwright scenarios mock `window.jarvisDesktop` and exercise UI/bridge contracts, not an installed Electron app. Keep model/checkpoint paths isolated when running backend tests so they do not load the owner's checkpoint.

## 8. Security principles

- Never put GGUF, PostgreSQL data, database dumps, credentials, `backend.env`, history, backups or secrets into installer or git.
- Preserve `shell: false` for child process execution; invoke trusted executables via well-defined paths.
- Validate paths, avoid symlink/junction traversal, fail closed on partial database state.
- Keep DB credential handling private, ACLs appropriately restrictive, protected IPC and renderer isolation.
- Preserve GitHub release updater security and version continuity; an unsigned installer is a warning and legal/release checks remain required.

## 9. Aspirational roadmap after stability

- Reliable clean install and first run without Python, Docker or separately installed Java.
- Persist/restart chat history, Flyway migrations and safe database upgrades.
- Qwen provisioning verification and offline startup behavior.
- Complete release audit, legal notices, code-signing decision, installer update/rollback checks.
- Further validation and improvement of the existing AI Lab proposal/test/apply workflow; safe auditing and voice notification remain separate work.
- Additional assistant/voice features in separate, tested increments.

## 10. Verified 17.6.10 snapshot and remaining release blockers

Results actually obtained in the 2026-11-11 session:

| Check | Result and scope |
| --- | --- |
| Angular/Vitest | 133/133 tests passed, 45 test files |
| Angular production build | PASS; existing SCSS budget warnings in `frontend/src/app/features/chat/chat-view/chat-view.scss` and `frontend/src/app/features/ai-lab/agent-planner/agent-planner.scss` |
| Playwright Chromium | 32/32 passed; the training fixture was corrected to return arrays for list operations instead of causing Angular iteration errors |
| Java/JUnit | 258 tests passed against isolated H2 |
| Node suite (desktop, scripts and builder checks) | 257 total, 252 PASS, 5 SKIP, 0 FAIL; includes nested ASAR checks and native-smoke tooling tests |
| Python release tools | 37 total, 36 PASS, 1 SKIP, 0 FAIL |
| Native PostgreSQL smoke | PASS with a new temporary cluster and random loopback port; real PostgreSQL initialization, authentication, persistence/restart and shutdown verified without touching user JarvisData |
| Native smoke extended with backend | PASS: real PostgreSQL 17.11 and bundled Java 21 on separate random loopback ports; Flyway V1–V5, authenticated/unauthenticated HTTP 200/401, REST conversation create/list and persistence after Java restart verified; SQL confirmed one conversation and zero messages; no model inference was requested |

The rebuilt installer is `dist/jarvis-17-5/J.A.R.V.I.S.-Setup-1.0.3-x64.exe`, **663,858,522 bytes**, SHA-256 **`1a2bad29c9650c4e5e1a0c307b9d35fec3c0db9c8e41958110b60402a1320b53`**. Static post-build verification passed: packaged Electron modules match source, required runtime/license resources exist, no GGUF/private data/backups are packaged, and the backend JAR has zero `.bak` resources and five Flyway migrations. This EXE supersedes the older pre-JarvisData artifact as the current build evidence; it was not installed over the owner's application.

The extended smoke used only its own temporary database/Java home and random ports (database 58202, HTTP 60533 in the successful run). Its evidence table lives in a separate `smoke_evidence` schema, leaving `public` empty before Flyway. The owned Java processes exited before PostgreSQL was stopped; PostgreSQL status confirmed shutdown and the successful run's temporary directory was removed. An earlier failed fixture attempt reported `JAVA_START_FAILED`; its stopped temporary directory `%TEMP%\jarvis-pg-native-smoke-ZAPutU` was preserved for diagnosis. The corrected fixture passed; this is not a repair or migration of the owner's real cluster.

The original Release Gate's new NSIS checks pass, but its overall result remains **BLOCKED**: the old installed directory lacks the expected license tree and has mismatched ASAR code, manual scenarios remain PENDING, and signing remains WARN. A successful build and isolated PostgreSQL/Java/Flyway smoke are not a complete release, a manual Electron gate or a successful first run on the owner's profile.

Cleanup was limited to a reversible move of four generated directories, **33,783,322 bytes**, to `%TEMP%\JarvisCleanup-2bbd59af2ebd4d77b33014a5fc14c1e1\`; restoration mappings are in `restore-map.json` there. Automatic approval review rejected the permanent deletion operation (`blockedbypolicy`); the move was not permanent deletion. The approximately 6.4 GB archive, unique backups, models and private configuration were preserved; local backups/generated artifacts are ignored by Git. Existing tracked deletions and unrelated working-tree changes must still be reviewed, not silently committed or discarded.
