package pl.bawar.jarvis.chat.api;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

/** Read live for every lookup; do not cache a setting that must take effect immediately. */
@Repository
public class InternetPreferenceRepository {
    private final JdbcTemplate jdbc;

    public InternetPreferenceRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public boolean enabled() {
        return Boolean.TRUE.equals(jdbc.queryForObject(
                "SELECT internet_enabled FROM jarvis_app_preferences WHERE id = 1", Boolean.class));
    }

    @Transactional
    public boolean save(boolean enabled) {
        jdbc.update("UPDATE jarvis_app_preferences SET internet_enabled = ?, updated_at = now() WHERE id = 1", enabled);
        return enabled();
    }
}
