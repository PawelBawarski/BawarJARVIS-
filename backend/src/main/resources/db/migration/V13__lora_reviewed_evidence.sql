CREATE TABLE lora_web_evidence (
 id UUID PRIMARY KEY,
 query_text VARCHAR(180) NOT NULL,
 title VARCHAR(400) NOT NULL,
 source_url VARCHAR(1200) NOT NULL,
 excerpt VARCHAR(1800) NOT NULL,
 instruction VARCHAR(800),
 response VARCHAR(1200),
 approved BOOLEAN NOT NULL DEFAULT FALSE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 reviewed_at TIMESTAMPTZ,
 CONSTRAINT lora_evidence_url_unique UNIQUE(source_url)
);
CREATE INDEX idx_lora_evidence_approved ON lora_web_evidence (approved, created_at DESC);
ALTER TABLE lora_training_runs ADD COLUMN dataset_id VARCHAR(80);
