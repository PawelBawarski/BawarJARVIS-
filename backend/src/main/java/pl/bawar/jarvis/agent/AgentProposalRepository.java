package pl.bawar.jarvis.agent;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.UUID;

@Repository
public class AgentProposalRepository {
    private static final RowMapper<AgentProposal> MAPPER = (rs, row) -> new AgentProposal(
        rs.getObject("id", UUID.class), rs.getString("task"), rs.getString("plan"),
        rs.getString("status"), rs.getObject("created_at", OffsetDateTime.class).toInstant(),
        rs.getObject("updated_at", OffsetDateTime.class).toInstant()
    );

    private final JdbcTemplate jdbc;

    public AgentProposalRepository(JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc);
    }

    public AgentProposal create(String task, String plan) {
        UUID id = UUID.randomUUID();
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        jdbc.update("""
            INSERT INTO jarvis_agent_proposals (id, task, plan, status, created_at, updated_at)
            VALUES (?, ?, ?, 'PENDING', ?, ?)
            """, id, task, plan, now, now);
        return find(id);
    }

    public List<AgentProposal> list() {
        return jdbc.query("""
            SELECT id, task, plan, status, created_at, updated_at
            FROM jarvis_agent_proposals ORDER BY created_at DESC, id DESC LIMIT 100
            """, MAPPER);
    }

    public AgentProposal find(UUID id) {
        return jdbc.query("""
            SELECT id, task, plan, status, created_at, updated_at
            FROM jarvis_agent_proposals WHERE id = ?
            """, MAPPER, id).stream().findFirst().orElseThrow(
                () -> new NoSuchElementException("Proposal not found: " + id));
    }

    /** A decision can happen exactly once. An approved plan cannot be changed. */
    public AgentProposal decide(UUID id, String decision) {
        int affected = jdbc.update("""
            UPDATE jarvis_agent_proposals SET status = ?, updated_at = ?
            WHERE id = ? AND status = 'PENDING'
            """, decision, OffsetDateTime.now(ZoneOffset.UTC), id);
        if (affected != 1) {
            find(id); // 404 if absent
            throw new IllegalStateException("The proposal has already been reviewed");
        }
        return find(id);
    }

    public AgentProposal revise(UUID id, String newPlan) {
        int affected = jdbc.update("""
            UPDATE jarvis_agent_proposals SET plan = ?, updated_at = ?
            WHERE id = ? AND status = 'PENDING'
            """, newPlan, OffsetDateTime.now(ZoneOffset.UTC), id);
        if (affected != 1) {
            find(id);
            throw new IllegalStateException("Only pending proposals may be revised");
        }
        return find(id);
    }
}
