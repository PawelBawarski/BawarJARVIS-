-- Shared PostgreSQL / H2 syntax; do not modify already-applied migrations V1-V4.
CREATE TABLE IF NOT EXISTS jarvis_agent_proposals (
    id UUID PRIMARY KEY,
    task VARCHAR(1200) NOT NULL,
    plan TEXT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT jarvis_agent_proposals_status_check CHECK (status IN ('PENDING','APPROVED','REJECTED'))
);
CREATE INDEX IF NOT EXISTS idx_jarvis_agent_proposals_created
    ON jarvis_agent_proposals (created_at DESC);
