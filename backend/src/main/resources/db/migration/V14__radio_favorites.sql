-- Private single-user J.A.R.V.I.S. radio favourites. Never store streamed audio.
CREATE TABLE jarvis_radio_favorites (
    station_id VARCHAR(80) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    country_code VARCHAR(2) NOT NULL CHECK (country_code IN ('PL','GB','DE','FR')),
    stream_url VARCHAR(2048) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_jarvis_radio_favorites_recent ON jarvis_radio_favorites(created_at DESC);
