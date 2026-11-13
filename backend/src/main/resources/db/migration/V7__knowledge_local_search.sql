-- Stage 20.1: full-text search for explicitly approved Wikipedia and local notes.
-- V4 remains intact. No embeddings, external model or automatic chat harvesting.
ALTER TABLE jarvis_knowledge
  ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('simple'::regconfig, coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(excerpt, '')), 'B')
  ) STORED;
CREATE INDEX idx_jarvis_knowledge_search ON jarvis_knowledge USING GIN (search_vector);
