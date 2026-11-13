# J.A.R.V.I.S. 20.2 — manual document import and text RAG

## Scope

- POST `/api/research/documents` (`multipart/form-data`, field `file`) with ROLE_JARVIS; no automatic import.
- GET `/api/research/documents` shows the 100 most recently imported documents.
- DELETE `/api/research/documents/{uuid}` requires a second in-app confirmation; PostgreSQL cascades the deletion to all chunks.
- Imported UTF-8 `.txt`/`.md` and text-based `.pdf` are split into overlapping segments. Extracted text, not original file bytes, is saved in existing `jarvis_knowledge` and indexed by the stage-20.1 GIN index.
- Existing `KnowledgeMemoryService.matches` and Chat/Qwen prompt retrieval continue unchanged. Imported chunks have `jarvis://document/<uuid>/<number>` source URLs.

## Limits and privacy

- Maximum uploaded bytes: 3 MiB; PDF: 60 pages; extracted text: 150,000 characters; chunk count: max 200.
- PDFBox 3.0.8 used locally. **No OCR** for scanned PDFs, no macros, no execution, no external services. Complex/malicious PDFs are still a parsing risk; use trusted sources in V1.
- De-duplication by SHA-256 of original file bytes; database enforces uniqueness.
- No automatic saving of chat messages. Only manually imported file text is persisted in PostgreSQL. Do not import private keys or passwords.
- Matching text is untrusted data, not instructions for Qwen. Search is PostgreSQL full-text, not semantic embeddings.
- `application.properties` sets multipart request limits to 4MB. A larger request is rejected before the controller.

## Installation and testing

```bash
cd ~/Desktop/Nauka/BawarJARVIS-
git apply --check ~/Downloads/JARVIS_STAGE_20_2_DOCUMENT_MEMORY.patch && \
git apply ~/Downloads/JARVIS_STAGE_20_2_DOCUMENT_MEMORY.patch
cd frontend
node scripts/install-stage20-2.cjs
node --test scripts/install-stage20-2.test.cjs
npm run check:i18n
npm test -- --watch=false
npm run build
npx playwright test e2e/memory-document-import-20-2.e2e.spec.ts
cd ../backend
./mvnw.cmd -Dtest=DocumentTextChunksTest,DocumentMemoryServiceTest,DocumentMemoryErrorHandlerTest test
```

Restart the Spring Boot backend and verify Flyway V8 completed before importing. Adobe scans with no selectable text are intentionally rejected (MEMORY_DOC_TEXT_EMPTY). Keep Java release 21.

## Security boundaries

`DocumentMemoryController` uses the existing ROLE_JARVIS authorization. Imported bytes are never written to the application's workspace or executed. The documents table has only metadata. Text chunks live in `jarvis_knowledge` and are removed by ON DELETE CASCADE. No background re-index job or network calls.
