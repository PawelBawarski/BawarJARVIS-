---
applyTo: "frontend/electron/**/*.cjs,frontend/electron/**/*.js,frontend/desktop/**/*.cjs,frontend/desktop/**/*.js,frontend/scripts/**/*.cjs"
---
# Electron / desktop boundaries
- Keep renderer unprivileged: no Node.js integration, broad IPC or unsafe eval.
- Expose the smallest possible bridge API and validate every IPC input and file path in the main process.
- Workspace access must remain allowlisted, consent-based and rooted in an explicitly chosen directory.
- Require explicit confirmation for writes, apply and rollback operations; do not auto-execute untrusted AI code.
- Do not weaken isolation, Docker checks, or session/token handling to make tests pass.
- Add node:test cases for bridge/security changes and run relevant installer/release checks.
