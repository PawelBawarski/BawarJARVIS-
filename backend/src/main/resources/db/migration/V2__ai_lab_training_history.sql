-- AI Lab 12.2: versioned, append-only training metrics and checkpoint evaluation records.
-- Never edit V1: its checksum is already recorded by Flyway.
ALTER TABLE jarvis_training_runs ADD COLUMN total_epochs INTEGER NOT NULL DEFAULT 0;
ALTER TABLE jarvis_training_runs ADD COLUMN completed_epochs INTEGER NOT NULL DEFAULT 0;
ALTER TABLE jarvis_training_runs ADD COLUMN example_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE jarvis_training_epoch_metrics (
    training_run_id UUID NOT NULL,
    epoch INTEGER NOT NULL,
    loss DOUBLE PRECISION NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY (training_run_id, epoch),
    CONSTRAINT fk_jarvis_epoch_run FOREIGN KEY (training_run_id)
        REFERENCES jarvis_training_runs(id) ON DELETE CASCADE,
    CONSTRAINT chk_jarvis_epoch_positive CHECK (epoch > 0),
    CONSTRAINT chk_jarvis_epoch_loss CHECK (loss >= 0)
);

ALTER TABLE jarvis_model_checkpoints ADD COLUMN file_size_bytes BIGINT;

CREATE TABLE jarvis_model_evaluations (
    id UUID PRIMARY KEY,
    checkpoint_id UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    mean_cross_entropy DOUBLE PRECISION NOT NULL,
    perplexity DOUBLE PRECISION NOT NULL,
    example_count INTEGER NOT NULL,
    corpus_sha256 CHAR(64) NOT NULL,
    CONSTRAINT fk_jarvis_evaluation_checkpoint FOREIGN KEY (checkpoint_id)
        REFERENCES jarvis_model_checkpoints(id) ON DELETE SET NULL,
    CONSTRAINT chk_jarvis_eval_examples CHECK (example_count > 0),
    CONSTRAINT chk_jarvis_eval_loss CHECK (mean_cross_entropy >= 0),
    CONSTRAINT chk_jarvis_eval_ppl CHECK (perplexity >= 1)
);

CREATE INDEX idx_jarvis_evaluations_created ON jarvis_model_evaluations(created_at DESC);
CREATE INDEX idx_jarvis_eval_checkpoint ON jarvis_model_evaluations(checkpoint_id);
