-- Separate from the experimental Java Transformer training history.
CREATE TABLE lora_training_runs (
  run_id VARCHAR(80) PRIMARY KEY,
  model_id VARCHAR(100) NOT NULL DEFAULT 'Qwen/Qwen3-0.6B',
  status VARCHAR(24) NOT NULL,
  total_steps INTEGER NOT NULL CHECK (total_steps BETWEEN 1 AND 200),
  completed_steps INTEGER NOT NULL DEFAULT 0,
  loss DOUBLE PRECISION,
  vram_mib INTEGER,
  error_message VARCHAR(500),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lora_training_runs_started_at ON lora_training_runs(started_at DESC);
