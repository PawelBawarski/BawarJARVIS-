package pl.bawar.jarvis.lab.dataset;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import java.util.List;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class DatasetRepositoryTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired DatasetService service;

    private static List<String> samples() {
        return List.of("aaa", "bbb", "ccc", "ddd", "eee", "fff", "ggg", "hhh", "iii", "jjj");
    }

    @Test void flywayV3CreatesDatasetTables() {
        assertEquals(1, jdbc.queryForObject(
                "SELECT COUNT(*) FROM flyway_schema_history WHERE version='3' AND success=TRUE", Integer.class));
        assertNotNull(jdbc.queryForObject("SELECT COUNT(*) FROM jarvis_dataset_examples", Integer.class));
    }

    @Test void persistsImmutableVersionsAndBothSplits() {
        var first = service.create("Zestaw " + UUID.randomUUID(), samples());
        assertEquals(1, first.versionNumber());
        assertEquals(8, first.trainingCount());
        assertEquals(2, first.validationCount());
        var loaded = service.readVersion(UUID.fromString(first.id()));
        assertEquals(8, loaded.trainingExamples().size());
        assertEquals(2, loaded.validationExamples().size());
        var next = service.newVersion(UUID.fromString(first.datasetId()),
                List.of("ala", "ma", "kota", "lubi", "ryby"));
        assertEquals(2, next.versionNumber());
        assertEquals(10, jdbc.queryForObject(
                "SELECT COUNT(*) FROM jarvis_dataset_examples WHERE version_id=?", Integer.class,
                UUID.fromString(first.id())));
        assertEquals(2, service.versions(UUID.fromString(first.datasetId())).size());
        assertEquals(1, service.readVersion(UUID.fromString(first.id())).versionNumber());
    }

    @Test void rejectsBadVersionWithoutInsertingPartialRows() {
        var dataset = service.create("Rollback " + UUID.randomUUID(), samples());
        UUID id = UUID.fromString(dataset.datasetId());
        assertThrows(IllegalArgumentException.class, () -> service.newVersion(id,
                List.of("a", "b", "c", "d", "a")));
        assertEquals(1, service.versions(id).size());
    }
}
