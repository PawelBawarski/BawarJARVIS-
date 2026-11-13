-- 20.2: document metadata; actual extracted text is indexed by V7 in jarvis_knowledge.
CREATE TABLE jarvis_documents (
    id UUID PRIMARY KEY,
    file_name VARCHAR(160) NOT NULL,
    file_kind VARCHAR(8) NOT NULL CHECK (file_kind IN ('pdf', 'txt', 'md')),
    sha256 CHAR(64) NOT NULL UNIQUE,
    byte_size INTEGER NOT NULL CHECK (byte_size > 0),
    chunk_count INTEGER NOT NULL CHECK (chunk_count BETWEEN 1 AND 200),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE jarvis_knowledge
    ADD COLUMN document_id UUID REFERENCES jarvis_documents(id) ON DELETE CASCADE;
CREATE INDEX idx_jarvis_knowledge_document ON jarvis_knowledge(document_id);
