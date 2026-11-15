-- Only local Qwen Chat uses this value; the AI Lab training budget stays separate.
ALTER TABLE jarvis_app_preferences
    ADD COLUMN chat_max_tokens INTEGER NOT NULL DEFAULT 256
        CHECK (chat_max_tokens BETWEEN 64 AND 1024);
