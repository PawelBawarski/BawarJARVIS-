package pl.bawar.jarvis.lab.history;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class LabHistoryRepositoryTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired LabHistoryRepository repo;

    @Test void flywayV2ExistsAndMigratedTables() {
        Integer success = jdbc.queryForObject("SELECT COUNT(*) FROM flyway_schema_history WHERE version='2' AND success=TRUE", Integer.class);
        assertEquals(1, success);
        assertNotNull(jdbc.queryForObject("SELECT COUNT(*) FROM jarvis_training_epoch_metrics", Integer.class));
        assertNotNull(jdbc.queryForObject("SELECT COUNT(*) FROM jarvis_model_evaluations", Integer.class));
    }

    @Test void persistsEpochLossAndCompletedRun() {
        UUID id = UUID.randomUUID();
        repo.started(id, 2, 3);
        repo.epoch(id, 1, 3, 1.8);
        repo.epoch(id, 2, 3, 0.6);
        repo.completed(id);
        var runs = repo.runs();
        var run = runs.stream().filter(r -> r.id().equals(id.toString())).findFirst().orElseThrow();
        assertEquals("completed", run.status());
        assertEquals(2, run.completedEpochs());
        assertEquals(6, jdbc.queryForObject("SELECT total_steps FROM jarvis_training_runs WHERE id=?", Integer.class, id));
        assertEquals(2, repo.epochs(id).size());
        assertEquals(.6, repo.epochs(id).get(1).loss(), 1e-10);
    }

    @Test void recordsCheckpointAndEvaluationWithoutExposingFilePath() {
        UUID id = UUID.randomUUID();
        String sha = "a".repeat(64);
        repo.checkpoint(id, null, "jarvis-tiny-v1", "C:\\secret\\path.ckpt", 42, sha);
        var ckpt = repo.checkpoints().stream().filter(c -> c.id().equals(id.toString())).findFirst().orElseThrow();
        assertEquals(42, ckpt.fileBytes());
        assertFalse(ckpt.toString().contains("secret"));
        UUID evalId = UUID.randomUUID();
        repo.evaluation(evalId, id, 0.3, Math.exp(.3), 2, "b".repeat(64));
        var after = repo.checkpoints().stream().filter(c -> c.id().equals(id.toString())).findFirst().orElseThrow();
        assertEquals(Math.exp(.3), after.evaluationPerplexity(), 1e-10);
    }
}
