# JARVIS Chat API development skill

- Target Java 21 and Spring Boot 4; do not replace existing SecurityFilterChain configuration.
- Keep all chat endpoints under `/api/chats` authenticated via method security; never permit-all to make tests pass.
- Keep REST DTO validation separate from model mathematics, no ad-hoc training inside controllers.
- Generate a response before writing to DB, then write user+assistant messages in a separate `@Transactional` Spring bean. Never hold a JDBC transaction during LLM inference.
- Preserve every original user message in the database; limit only the model prompt to its context window.
- Model is an educational tiny local Transformer. No fallback to third-party model weights and do not claim high-quality conversational ability.
- Chat database is presently single-user: don't expose it beyond loopback or to multiple identities until owner_id + access checks exist.
- Add unit tests and MockMvc contract tests for new endpoints, plus a transactional rollback test. Do not claim that mock MVC proves end-to-end HTTP security.
- When connecting Angular, add Vitest + Playwright, PL/EN translations, and render all model output as untrusted text.
