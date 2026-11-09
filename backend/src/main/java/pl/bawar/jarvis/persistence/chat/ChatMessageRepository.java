package pl.bawar.jarvis.persistence.chat;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

@Repository
public class ChatMessageRepository {
    private final JdbcTemplate jdbc;

    private static final RowMapper<ChatMessage> MAPPER = (rs, rowNum) ->
            new ChatMessage(
                    rs.getObject("id", UUID.class),
                    rs.getObject("conversation_id", UUID.class),
                    ChatRole.fromDatabase(rs.getString("role")),
                    rs.getString("content"),
                    rs.getObject("created_at", OffsetDateTime.class).toInstant(),
                    rs.getLong("message_order")
            );

    public ChatMessageRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public ChatMessage create(UUID conversationId, ChatRole role, String content) {
        UUID id = UUID.randomUUID();
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        jdbc.update("""
                INSERT INTO jarvis_messages (id, conversation_id, role, content, created_at)
                VALUES (?, ?, ?, ?, ?)
                """, id, conversationId, role.databaseValue(), content, now);

        return jdbc.queryForObject("""
                SELECT id, conversation_id, role, content, created_at, message_order
                FROM jarvis_messages WHERE id = ?
                """, MAPPER, id);
    }

    public List<ChatMessage> findByConversationId(UUID conversationId) {
        return jdbc.query("""
                SELECT id, conversation_id, role, content, created_at, message_order
                FROM jarvis_messages
                WHERE conversation_id = ?
                ORDER BY message_order ASC
                """, MAPPER, conversationId);
    }
}
