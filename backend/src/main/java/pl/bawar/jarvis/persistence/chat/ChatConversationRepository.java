package pl.bawar.jarvis.persistence.chat;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class ChatConversationRepository {
    private final JdbcTemplate jdbc;

    private static final RowMapper<ChatConversation> MAPPER = (rs, rowNum) -> new ChatConversation(
            rs.getObject("id", UUID.class),
            rs.getString("title"),
            rs.getObject("created_at", OffsetDateTime.class).toInstant(),
            rs.getObject("updated_at", OffsetDateTime.class).toInstant());

    public ChatConversationRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public ChatConversation create(String title) {
        UUID id = UUID.randomUUID();
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        jdbc.update("""
                INSERT INTO jarvis_conversations (id, title, created_at, updated_at)
                VALUES (?, ?, ?, ?)
                """, id, title, now, now);
        return new ChatConversation(id, title, now.toInstant(), now.toInstant());
    }

    public Optional<ChatConversation> findById(UUID id) {
        return jdbc.query("""
                SELECT id, title, created_at, updated_at
                FROM jarvis_conversations
                WHERE id = ?
                """, MAPPER, id).stream().findFirst();
    }

    public List<ChatConversation> findAll() {
        return jdbc.query("""
                SELECT id, title, created_at, updated_at
                FROM jarvis_conversations
                ORDER BY updated_at DESC, created_at DESC, id
                """, MAPPER);
    }

    public void touch(UUID id) {
        jdbc.update("""
                UPDATE jarvis_conversations
                SET updated_at = ?
                WHERE id = ?
                """, OffsetDateTime.now(ZoneOffset.UTC), id);
    }

    public boolean delete(UUID id) {
        return jdbc.update("DELETE FROM jarvis_conversations WHERE id = ?", id) == 1;
    }

    public Optional<ChatConversation> rename(UUID id, String title) {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        int updated = jdbc.update("""
                UPDATE jarvis_conversations
                SET title = ?, updated_at = ?
                WHERE id = ?
                """, title, now, id);

        if (updated != 1) {
            return Optional.empty();
        }

        return findById(id);
    }
}
