---
applyTo: "backend/src/**/*.java,backend/src/**/*.sql,backend/src/**/*.properties,backend/pom.xml"
---
# Spring Boot / Java 21
- Preserve Controller -> Service -> Repository responsibilities, DTO validation and predictable API errors.
- Treat authorization as server-side, never as an Angular-only condition; avoid leaking internals in response bodies.
- Use parameterized SQL and transactions for multi-step persistence operations.
- PostgreSQL is the source of truth; add versioned Flyway migrations rather than editing applied migrations.
- Add or update JUnit tests including request validation, security, failure paths and database integration as appropriate.
- Integration tests require a working Docker/Testcontainers environment: report BLOCKED instead of skipping silently.
- Preserve request-id observability and avoid logs containing tokens, request bodies or sensitive content.
- Never automatically retry non-idempotent mutations after uncertain delivery.
