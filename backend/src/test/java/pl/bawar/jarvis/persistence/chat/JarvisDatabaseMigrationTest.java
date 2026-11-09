package pl.bawar.jarvis.persistence.chat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
class JarvisDatabaseMigrationTest {
    @Autowired
    JdbcTemplate jdbc;

    @Test
    void flywayCreatedAllFourJarvisTables() {
        for (String table : new String[]{
                "jarvis_conversations", "jarvis_messages",
                "jarvis_training_runs", "jarvis_model_checkpoints"}) {
            Integer count = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM " + table, Integer.class);
            assertTrue(count != null && count >= 0, table);
        }
    }

    @Test
    void flywayRecordedMigration() {
        Integer applied = jdbc.queryForObject("""
                SELECT COUNT(*) FROM flyway_schema_history
                WHERE version = '1' AND success = TRUE
                """, Integer.class);
        assertEquals(1, applied);
    }
}
