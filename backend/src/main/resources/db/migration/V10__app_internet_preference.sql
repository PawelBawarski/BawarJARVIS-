-- User preference persisted in PostgreSQL; single local J.A.R.V.I.S. profile.
CREATE TABLE jarvis_app_preferences (
    id SMALLINT PRIMARY KEY CHECK (id = 1),
    internet_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO jarvis_app_preferences(id, internet_enabled) VALUES (1, FALSE);
