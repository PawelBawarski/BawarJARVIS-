-- 20.3: locally generated embedding vectors. No pgvector extension is required.
-- One row per approved knowledge chunk; deleting a chunk cascades to its embedding.
CREATE TABLE jarvis_knowledge_embeddings (
    knowledge_id UUID PRIMARY KEY REFERENCES jarvis_knowledge(id) ON DELETE CASCADE,
    model_id VARCHAR(100) NOT NULL,
    source_hash CHAR(64) NOT NULL,
    dimensions INTEGER NOT NULL CHECK (dimensions BETWEEN 32 AND 2048),
    vector BYTEA NOT NULL,
    indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_jarvis_knowledge_embeddings_model ON jarvis_knowledge_embeddings(model_id);
