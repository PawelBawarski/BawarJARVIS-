package pl.bawar.jarvis.lab.history;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

/** JDBC storage. Raw corpus, secret token and checkpoint file path are never returned in API DTOs. */
@Repository
public class LabHistoryRepository {
    private final JdbcTemplate jdbc;

    public LabHistoryRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    private static OffsetDateTime now() { return OffsetDateTime.now(ZoneOffset.UTC); }
    private static String iso(OffsetDateTime value) { return value == null ? null : value.toInstant().toString(); }

    public record Run(String id, String status, String startedAt, String finishedAt,
                      int totalEpochs, int completedEpochs, int exampleCount,
                      Double finalLoss, String error) { }
    public record Epoch(int epoch, double loss) { }
    public record Checkpoint(String id, String trainingRunId, String createdAt,
                             String modelVersion, long fileBytes, String sha256,
                             Double trainingLoss, Double evaluationPerplexity,
                             String evaluationCorpusSha256) { }
    public record Evaluation(String id, String checkpointId, String createdAt,
                             double meanCrossEntropy, double perplexity,
                             int exampleCount, String corpusSha256) { }

    public void started(UUID id, int epochs, int examples) {
        jdbc.update("""
          INSERT INTO jarvis_training_runs
          (id, status, started_at, total_steps, total_epochs, completed_epochs, example_count)
          VALUES (?, 'running', ?, 0, ?, 0, ?)
          """, id, now(), epochs, examples);
    }

    @Transactional
    public void epoch(UUID id, int number, int examples, double loss) {
        jdbc.update("""
          INSERT INTO jarvis_training_epoch_metrics
          (training_run_id, epoch, loss, recorded_at) VALUES (?, ?, ?, ?)
          """, id, number, loss, now());
        int updated = jdbc.update("""
          UPDATE jarvis_training_runs
          SET completed_epochs = ?, total_steps = ?, final_loss = ?
          WHERE id = ? AND status = 'running'
          """, number, number * examples, loss, id);
        if (updated != 1) throw new IllegalStateException("No active training run");
    }

    public void completed(UUID id) {
        jdbc.update("""
          UPDATE jarvis_training_runs SET status='completed', finished_at=?
          WHERE id=? AND status='running'
          """, now(), id);
    }

    public void failed(UUID id) {
        jdbc.update("""
          UPDATE jarvis_training_runs
          SET status='failed', finished_at=?, error_message='TRAINING_FAILED'
          WHERE id=? AND status='running'
          """, now(), id);
    }

    /** Called once on startup: only our own unfinished jobs are orphaned after a restart. */
    public void markInterrupted() {
        jdbc.update("""
          UPDATE jarvis_training_runs SET status='failed', finished_at=?,
          error_message='INTERRUPTED_ON_RESTART' WHERE status='running'
          """, now());
    }

    public List<Run> runs() {
        return jdbc.query("""
          SELECT id, status, started_at, finished_at, total_epochs, completed_epochs,
                 example_count, final_loss, error_message
          FROM jarvis_training_runs ORDER BY started_at DESC, id DESC LIMIT 30
          """, (rs, n) -> new Run(
                rs.getObject("id", UUID.class).toString(), rs.getString("status"),
                iso(rs.getObject("started_at", OffsetDateTime.class)),
                iso(rs.getObject("finished_at", OffsetDateTime.class)),
                rs.getInt("total_epochs"), rs.getInt("completed_epochs"),
                rs.getInt("example_count"),
                (Double) rs.getObject("final_loss"), rs.getString("error_message")));
    }

    public List<Epoch> epochs(UUID runId) {
        return jdbc.query("""
          SELECT epoch, loss FROM jarvis_training_epoch_metrics
          WHERE training_run_id=? ORDER BY epoch ASC
          """, (rs, n) -> new Epoch(rs.getInt("epoch"), rs.getDouble("loss")), runId);
    }

    public void checkpoint(UUID id, UUID runId, String version, String path, long size, String sha256) {
        jdbc.update("""
          INSERT INTO jarvis_model_checkpoints
          (id, training_run_id, model_version, file_path, sha256, created_at, file_size_bytes)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          """, id, runId, version, path, sha256, now(), size);
    }

    public List<Checkpoint> checkpoints() {
        return jdbc.query("""
          SELECT c.id, c.training_run_id, c.created_at, c.model_version,
                 c.file_size_bytes, c.sha256, t.final_loss AS training_loss,
                 (SELECT e.perplexity FROM jarvis_model_evaluations e
                   WHERE e.checkpoint_id=c.id ORDER BY e.created_at DESC, e.id DESC LIMIT 1)
                   AS evaluation_perplexity,
                 (SELECT e.corpus_sha256 FROM jarvis_model_evaluations e
                   WHERE e.checkpoint_id=c.id ORDER BY e.created_at DESC, e.id DESC LIMIT 1)
                   AS evaluation_corpus_sha256
          FROM jarvis_model_checkpoints c
          LEFT JOIN jarvis_training_runs t ON t.id=c.training_run_id
          WHERE c.file_size_bytes IS NOT NULL AND c.sha256 IS NOT NULL
          ORDER BY c.created_at DESC, c.id DESC LIMIT 30
          """, (rs, n) -> new Checkpoint(
                rs.getObject("id", UUID.class).toString(),
                rs.getObject("training_run_id") == null ? null : rs.getObject("training_run_id").toString(),
                iso(rs.getObject("created_at", OffsetDateTime.class)),
                rs.getString("model_version"), rs.getLong("file_size_bytes"),
                rs.getString("sha256"), (Double) rs.getObject("training_loss"),
                (Double) rs.getObject("evaluation_perplexity"),
                rs.getString("evaluation_corpus_sha256")));
    }

    public UUID latestMatchingCheckpoint(String sha256) {
        List<UUID> ids = jdbc.query("""
          SELECT id FROM jarvis_model_checkpoints
          WHERE sha256=? AND file_size_bytes IS NOT NULL
          ORDER BY created_at DESC, id DESC LIMIT 1
          """, (rs, n) -> rs.getObject("id", UUID.class), sha256);
        return ids.isEmpty() ? null : ids.get(0);
    }

    public void evaluation(UUID id, UUID checkpointId, double loss, double perplexity,
                           int exampleCount, String corpusSha256) {
        jdbc.update("""
          INSERT INTO jarvis_model_evaluations
          (id, checkpoint_id, created_at, mean_cross_entropy, perplexity, example_count, corpus_sha256)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          """, id, checkpointId, now(), loss, perplexity, exampleCount, corpusSha256);
    }

    public List<Evaluation> evaluations() {
        return jdbc.query("""
          SELECT id, checkpoint_id, created_at, mean_cross_entropy, perplexity,
                 example_count, corpus_sha256 FROM jarvis_model_evaluations
          ORDER BY created_at DESC, id DESC LIMIT 30
          """, (rs, n) -> new Evaluation(
                rs.getObject("id", UUID.class).toString(),
                rs.getObject("checkpoint_id") == null ? null : rs.getObject("checkpoint_id").toString(),
                iso(rs.getObject("created_at", OffsetDateTime.class)),
                rs.getDouble("mean_cross_entropy"), rs.getDouble("perplexity"),
                rs.getInt("example_count"), rs.getString("corpus_sha256")));
    }
}
