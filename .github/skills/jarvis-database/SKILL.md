---
name: jarvis-database
description: PostgreSQL, Flyway, Spring JDBC and chat persistence conventions for J.A.R.V.I.S.
---

# J.A.R.V.I.S. Database conventions

- Database name for Jarvis: `jarvis_db`, local container published only to `127.0.0.1:5433`.
- Use versioned Flyway migrations under `backend/src/main/resources/db/migration`; do **not** edit an already applied migration. Always introduce V2, V3 and so on.
- Tables use prefix `jarvis_`: `jarvis_conversations`, `jarvis_messages`, `jarvis_training_runs`, `jarvis_model_checkpoints`.
- Use parameterized SQL via `JdbcTemplate`; never build SQL queries by interpolating user input. Table names must stay constant and trusted.
- Transaction boundaries are in Spring services. Persist conversation and message updates atomically. Deleting a conversation cascades its messages.
- DB stores message history and metadata of model training/checkpoints, not binary model weights. Large checkpoint files remain on disk.
- Keep database secrets out of Git and Angular/Electron renderer; credentials are supplied via environment variables.
- Unit and Spring context tests use H2 (`backend/src/test/resources/application.properties`); before shipping, run a smoke test with PostgreSQL itself.
- FE ChatStore currently still uses temporary local storage: replace with authenticated backend API in upcoming BE 11.3 / FE 11.4, then remove the old storage path.
- Respect the existing Spring Security policy. Do not expose new endpoints without authenticating and validating requests.
- Always add JUnit tests for DB updates, cascade deletes and Flyway migrations. If Angular ChatStore changes, add Vitest and Playwright E2E.
