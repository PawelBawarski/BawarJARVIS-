package pl.bawar.jarvis.chat.api;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class InternetPreferenceRepositoryTest {
    @Test void readsPreferenceFromPostgresWithoutUsingBrowserStorage() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(
                "SELECT internet_enabled FROM jarvis_app_preferences WHERE id = 1", Boolean.class))
                .thenReturn(true);
        assertTrue(new InternetPreferenceRepository(jdbc).enabled());
    }

    @Test void savesPreferenceAndReturnsPersistedState() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(
                "SELECT internet_enabled FROM jarvis_app_preferences WHERE id = 1", Boolean.class))
                .thenReturn(false);
        var repo = new InternetPreferenceRepository(jdbc);
        assertFalse(repo.save(false));
        verify(jdbc).update(
                "UPDATE jarvis_app_preferences SET internet_enabled = ?, updated_at = now() WHERE id = 1",
                false);
    }
}
