package pl.bawar.jarvis.agent;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Metadata-only audit of completed server-side Docker checks; no source, logs or secrets. */
@Repository
public class AgentProjectCheckHistoryRepository {
    private final JdbcTemplate jdbc;

    public AgentProjectCheckHistoryRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public record Run(UUID checkId, String kind, String status, String relativePath,
                      String proposedSha256, String snapshotSha256, String image,
                      int fileCount, long elapsedMs, Instant createdAt) { }

    public void save(AgentProjectCheckService.Result result) {
        jdbc.update("""
            INSERT INTO jarvis_agent_project_check_history
            (check_id, kind, status, relative_path, proposed_sha256, snapshot_sha256,
             image_name, file_count, elapsed_ms)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, UUID.fromString(result.checkId()), result.kind(), result.status(),
                result.relativePath(), result.proposedSha256(), result.snapshotSha256(),
                result.image(), result.fileCount(), result.elapsedMs());
    }

    public List<Run> recent(int limit) {
        int safeLimit = Math.max(1, Math.min(50, limit));
        return jdbc.query("""
            SELECT check_id, kind, status, relative_path, proposed_sha256, snapshot_sha256,
                   image_name, file_count, elapsed_ms, created_at
            FROM jarvis_agent_project_check_history
            ORDER BY created_at DESC, check_id DESC LIMIT ?
            """, (rs, row) -> new Run(
                rs.getObject("check_id", UUID.class), rs.getString("kind"), rs.getString("status"),
                rs.getString("relative_path"), rs.getString("proposed_sha256"),
                rs.getString("snapshot_sha256"), rs.getString("image_name"),
                rs.getInt("file_count"), rs.getLong("elapsed_ms"),
                rs.getObject("created_at", OffsetDateTime.class).toInstant()
            ), safeLimit);
    }
}
