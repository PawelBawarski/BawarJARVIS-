CREATE TABLE IF NOT EXISTS jarvis_knowledge (
  id UUID PRIMARY KEY,
  title VARCHAR(250) NOT NULL,
  source_url VARCHAR(600) NOT NULL UNIQUE,
  excerpt TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_jarvis_knowledge_created ON jarvis_knowledge(created_at DESC);
