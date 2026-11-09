# JARVIS: Workspace and agent permissions

- Do not modify existing UI modules when adding new AI Lab capabilities; append self-contained components and tests.
- A workspace path is selected only by native Electron dialog in trusted main process. Never accept arbitrary absolute renderer paths.
- AI Lab 12.4 is strictly read-only: no `fs.write*`, `rm`, shell commands, build invocations or network imports.
- Protect source files: reject path traversal, link escapes, hidden/secret names, oversized and non-text files.
- Never give agent tools or models direct Node/Electron APIs. Use auditable allowlisted IPC actions.
- Future code editing must use temp worktrees/sandbox, per-file diff preview, explicit user approval, tests, rollback and resource limits.
- After every agent iteration (future 12.5) send a status notification. Avoid perpetual unattended self-modification.
- Preserve existing project security, all PL/EN translations and Vitest+Playwright tests.
