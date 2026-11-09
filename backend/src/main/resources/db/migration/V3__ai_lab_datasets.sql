-- Immutable training/validation dataset versions. Raw examples remain in local PostgreSQL.
CREATE TABLE jarvis_datasets (
    id UUID PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE jarvis_dataset_versions (
    id UUID PRIMARY KEY,
    dataset_id UUID NOT NULL REFERENCES jarvis_datasets(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL CHECK (version_number > 0),
    content_sha256 CHAR(64) NOT NULL,
    validation_sha256 CHAR(64) NOT NULL,
    training_count INTEGER NOT NULL CHECK (training_count >= 1),
    validation_count INTEGER NOT NULL CHECK (validation_count >= 1),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_jarvis_dataset_version UNIQUE (dataset_id, version_number)
);

CREATE TABLE jarvis_dataset_examples (
    version_id UUID NOT NULL REFERENCES jarvis_dataset_versions(id) ON DELETE CASCADE,
    subset VARCHAR(10) NOT NULL CHECK (subset IN ('TRAIN','VALIDATION')),
    position INTEGER NOT NULL CHECK (position >= 0),
    content VARCHAR(256) NOT NULL CHECK (char_length(content) >= 1),
    PRIMARY KEY(version_id, subset, position)
);

CREATE INDEX idx_jarvis_dataset_versions_latest
    ON jarvis_dataset_versions(dataset_id, version_number DESC);
