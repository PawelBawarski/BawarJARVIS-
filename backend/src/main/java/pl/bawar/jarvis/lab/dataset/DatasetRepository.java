package pl.bawar.jarvis.lab.dataset;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

@Repository
public class DatasetRepository {
    private final JdbcTemplate jdbc;
    public DatasetRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public record Summary(String id, String name, String createdAt,
                          String latestVersionId, int latestVersion,
                          int trainingCount, int validationCount, String validationSha256) { }
    public record Version(String id, String datasetId, int versionNumber,
                          String createdAt, int trainingCount, int validationCount,
                          String contentSha256, String validationSha256) { }
    public record Samples(String id, String datasetId, String name, int versionNumber,
                          String validationSha256, List<String> trainingExamples,
                          List<String> validationExamples) { }

    private static OffsetDateTime now() { return OffsetDateTime.now(ZoneOffset.UTC); }
    private static String iso(ResultSet rs, String name) throws SQLException {
        return rs.getObject(name, OffsetDateTime.class).toInstant().toString();
    }
    private static Version mapVersion(ResultSet rs, int i) throws SQLException {
        return new Version(rs.getObject("id", UUID.class).toString(),
                rs.getObject("dataset_id", UUID.class).toString(),
                rs.getInt("version_number"), iso(rs, "created_at"),
                rs.getInt("training_count"), rs.getInt("validation_count"),
                rs.getString("content_sha256"), rs.getString("validation_sha256"));
    }

    public void createDataset(UUID id, String name) {
        jdbc.update("INSERT INTO jarvis_datasets(id, name, created_at) VALUES (?, ?, ?)", id, name, now());
    }

    /** Must run inside the same transaction as insertVersion. */
    public int lockAndNextVersion(UUID datasetId) {
        List<UUID> rows = jdbc.query("SELECT id FROM jarvis_datasets WHERE id=? FOR UPDATE",
                (rs, i) -> rs.getObject(1, UUID.class), datasetId);
        if (rows.isEmpty()) throw new IllegalArgumentException("Unknown dataset");
        Integer number = jdbc.queryForObject(
                "SELECT COALESCE(MAX(version_number), 0) + 1 FROM jarvis_dataset_versions WHERE dataset_id=?",
                Integer.class, datasetId);
        return number == null ? 1 : number;
    }

    public Version insertVersion(UUID versionId, UUID datasetId, int versionNumber, DatasetService.Partition data) {
        OffsetDateTime timestamp = now();
        jdbc.update("""
            INSERT INTO jarvis_dataset_versions
            (id, dataset_id, version_number, content_sha256, validation_sha256,
              training_count, validation_count, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, versionId, datasetId, versionNumber, data.fullSha256(), data.validationSha256(),
                data.training().size(), data.validation().size(), timestamp);
        insertExamples(versionId, "TRAIN", data.training());
        insertExamples(versionId, "VALIDATION", data.validation());
        return new Version(versionId.toString(), datasetId.toString(), versionNumber,
                timestamp.toInstant().toString(), data.training().size(), data.validation().size(),
                data.fullSha256(), data.validationSha256());
    }
    private void insertExamples(UUID versionId, String subset, List<String> values) {
        for (int i = 0; i < values.size(); i++) {
            jdbc.update("INSERT INTO jarvis_dataset_examples(version_id,subset,position,content) VALUES (?,?,?,?)",
                    versionId, subset, i, values.get(i));
        }
    }

    public List<Summary> listDatasets() {
        return jdbc.query("""
            SELECT d.id, d.name, d.created_at,
              v.id AS latest_version_id, v.version_number,
              v.training_count, v.validation_count, v.validation_sha256
            FROM jarvis_datasets d
            JOIN jarvis_dataset_versions v ON v.dataset_id=d.id
            WHERE v.version_number=(SELECT MAX(v2.version_number)
              FROM jarvis_dataset_versions v2 WHERE v2.dataset_id=d.id)
            ORDER BY d.created_at DESC, d.id DESC LIMIT 50
            """, (rs, i) -> new Summary(rs.getObject("id", UUID.class).toString(),
                rs.getString("name"), iso(rs, "created_at"),
                rs.getObject("latest_version_id", UUID.class).toString(),
                rs.getInt("version_number"), rs.getInt("training_count"),
                rs.getInt("validation_count"), rs.getString("validation_sha256")));
    }

    public List<Version> versions(UUID datasetId) {
        return jdbc.query("""
            SELECT id, dataset_id, version_number, content_sha256, validation_sha256,
                   training_count, validation_count, created_at
            FROM jarvis_dataset_versions WHERE dataset_id=?
            ORDER BY version_number DESC LIMIT 30
            """, DatasetRepository::mapVersion, datasetId);
    }

    public Samples readVersion(UUID versionId) {
        List<Samples> versions = jdbc.query("""
            SELECT v.id, v.dataset_id, d.name, v.version_number, v.validation_sha256
            FROM jarvis_dataset_versions v JOIN jarvis_datasets d ON d.id=v.dataset_id
            WHERE v.id=?
            """, (rs, i) -> new Samples(rs.getObject("id", UUID.class).toString(),
                rs.getObject("dataset_id", UUID.class).toString(), rs.getString("name"),
                rs.getInt("version_number"), rs.getString("validation_sha256"), List.of(), List.of()), versionId);
        if (versions.isEmpty()) throw new IllegalArgumentException("Unknown dataset version");
        Samples info = versions.get(0);
        List<String> training = readExamples(versionId, "TRAIN");
        List<String> validation = readExamples(versionId, "VALIDATION");
        return new Samples(info.id(), info.datasetId(), info.name(), info.versionNumber(),
                info.validationSha256(), training, validation);
    }
    private List<String> readExamples(UUID versionId, String subset) {
        return jdbc.query("""
            SELECT content FROM jarvis_dataset_examples WHERE version_id=? AND subset=?
            ORDER BY position ASC
            """, (rs, i) -> rs.getString(1), versionId, subset);
    }
}
