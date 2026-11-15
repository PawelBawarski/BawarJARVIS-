package pl.bawar.jarvis.chat.api;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ChatGenerationPreferenceRepositoryTest {
    @Test void rejectsOutOfRangeWithoutWriting() {
        JdbcTemplate db = mock(JdbcTemplate.class);
        var repo = new ChatGenerationPreferenceRepository(db);
        assertThrows(IllegalArgumentException.class, () -> repo.save(63));
        assertThrows(IllegalArgumentException.class, () -> repo.save(1025));
        verifyNoInteractions(db);
    }

    @Test void savesValidLimitAndReadsBack() {
        JdbcTemplate db = mock(JdbcTemplate.class);
        when(db.update(anyString(), eq(512))).thenReturn(1);
        when(db.queryForObject(anyString(), eq(Integer.class))).thenReturn(512);
        var repo = new ChatGenerationPreferenceRepository(db);
        assertEquals(512, repo.save(512));
    }
}
