-- Store metadata about actual server-side project checks; never persist uploaded code or test logs.
CREATE TABLE IF NOT EXISTS jarvis_agent_project_check_history (
    check_id UUID PRIMARY KEY,
    kind VARCHAR(16) NOT NULL,
    status VARCHAR(16) NOT NULL,
    relative_path VARCHAR(240) NOT NULL,
    proposed_sha256 CHAR(64) NOT NULL,
    snapshot_sha256 CHAR(64) NOT NULL,
    image_name VARCHAR(200) NOT NULL,
    file_count INTEGER NOT NULL,
    elapsed_ms BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT jarvis_project_check_kind CHECK (kind IN ('angular','spring')),
    CONSTRAINT jarvis_project_check_status CHECK (status IN ('passed','failed','timeout','unavailable'))
);
CREATE INDEX IF NOT EXISTS idx_jarvis_project_checks_created
    ON jarvis_agent_project_check_history (created_at DESC, check_id DESC);
