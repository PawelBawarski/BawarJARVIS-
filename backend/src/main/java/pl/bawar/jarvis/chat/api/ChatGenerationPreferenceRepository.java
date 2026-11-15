package pl.bawar.jarvis.chat.api;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

/** Persistent single-profile generation settings. Only Chat Qwen uses this. */
@Repository
public class ChatGenerationPreferenceRepository {
    public static final int MIN_TOKENS = 64;
    public static final int MAX_TOKENS = 1024;
    public static final int DEFAULT_TOKENS = 256;
    private final JdbcTemplate jdbc;

    public ChatGenerationPreferenceRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public int maxTokens() {
        Integer result = jdbc.queryForObject(
            "SELECT chat_max_tokens FROM jarvis_app_preferences WHERE id = 1", Integer.class);
        return result == null ? DEFAULT_TOKENS : result;
    }

    @Transactional
    public int save(int value) {
        if (value < MIN_TOKENS || value > MAX_TOKENS)
            throw new IllegalArgumentException("chatMaxTokens must be 64..1024");
        int updated = jdbc.update(
            "UPDATE jarvis_app_preferences SET chat_max_tokens = ?, updated_at = now() WHERE id = 1", value);
        if (updated != 1) throw new IllegalStateException("Chat settings profile missing");
        return maxTokens();
    }
}
