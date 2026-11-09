-- Pierwsza migracja dla nowej, odrebnej bazy jarvis_db.
-- Flyway uruchamia ja tylko raz i zapisuje wynik w flyway_schema_history.

CREATE TABLE jarvis_conversations (
    id UUID PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT chk_jarvis_conversation_title CHECK (CHAR_LENGTH(TRIM(title)) > 0)
);

CREATE INDEX idx_jarvis_conversations_updated
    ON jarvis_conversations (updated_at DESC);

CREATE TABLE jarvis_messages (
    id UUID PRIMARY KEY,
    conversation_id UUID NOT NULL,
    message_order BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT fk_jarvis_message_conversation
        FOREIGN KEY (conversation_id)
        REFERENCES jarvis_conversations(id)
        ON DELETE CASCADE,
    CONSTRAINT chk_jarvis_message_role
        CHECK (role IN ('user', 'assistant', 'system')),
    CONSTRAINT chk_jarvis_message_content
        CHECK (CHAR_LENGTH(TRIM(content)) > 0 AND CHAR_LENGTH(content) <= 20000)
);

CREATE INDEX idx_jarvis_messages_order
    ON jarvis_messages (conversation_id, message_order);

CREATE TABLE jarvis_training_runs (
    id UUID PRIMARY KEY,
    status VARCHAR(20) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    finished_at TIMESTAMP WITH TIME ZONE,
    total_steps INTEGER NOT NULL DEFAULT 0,
    final_loss DOUBLE PRECISION,
    error_message TEXT,
    CONSTRAINT chk_jarvis_training_status
        CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    CONSTRAINT chk_jarvis_training_steps CHECK (total_steps >= 0)
);

CREATE INDEX idx_jarvis_training_started
    ON jarvis_training_runs (started_at DESC);

CREATE TABLE jarvis_model_checkpoints (
    id UUID PRIMARY KEY,
    training_run_id UUID,
    model_version VARCHAR(100) NOT NULL,
    file_path VARCHAR(1024) NOT NULL,
    sha256 CHAR(64),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT fk_jarvis_checkpoint_training
        FOREIGN KEY (training_run_id)
        REFERENCES jarvis_training_runs(id)
        ON DELETE SET NULL
);

CREATE INDEX idx_jarvis_checkpoints_created
    ON jarvis_model_checkpoints (created_at DESC);
