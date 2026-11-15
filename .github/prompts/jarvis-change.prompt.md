# J.A.R.V.I.S. safe change request

Given the developer's requested change:
1. Identify the exact affected files using repository-relative paths.
2. Describe existing behavior, safety invariants and minimum change required.
3. Propose changes only within those files; call out new dependencies or migrations.
4. Provide Vitest + Playwright for Angular, JUnit for backend, or node:test for Electron, as applicable.
5. Run available checks when permitted; clearly distinguish PASS, FAIL, BLOCKED and NOT RUN.
6. For AI Lab, never bypass diff preview, explicit consent, isolated test and rollback workflow.
7. Do not assert completion until test evidence exists.
