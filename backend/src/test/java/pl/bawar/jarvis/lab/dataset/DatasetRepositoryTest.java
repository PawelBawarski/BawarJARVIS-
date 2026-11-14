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


    @Test void datasetQueriesHaveRequiredDatabaseIndexes() {
        var versionsIndexes = jdbc.queryForList("""
            SELECT indexname
            FROM pg_indexes
            WHERE schemaname = current_schema()
              AND tablename = 'jarvis_dataset_versions'
            """, String.class);

        var examplesIndexes = jdbc.queryForList("""
            SELECT indexname
            FROM pg_indexes
            WHERE schemaname = current_schema()
              AND tablename = 'jarvis_dataset_examples'
            """, String.class);

        assertTrue(
            versionsIndexes.contains("uq_jarvis_dataset_version"),
            "Missing unique dataset version index"
        );

        assertTrue(
            versionsIndexes.contains("idx_jarvis_dataset_versions_latest"),
            "Missing latest-version index"
        );

        assertTrue(
            examplesIndexes.contains("jarvis_dataset_examples_pkey"),
            "Missing example ordering primary-key index"
        );
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


    @Test void batchInsertPreservesAllExamplesAndTheirOrder() {
        List<String> examples = java.util.stream.IntStream.range(0, 100)
            .mapToObj(i -> "example-" + i)
            .toList();

        DatasetService.Partition expected = DatasetService.partition(examples);

        var created = service.create(
            "Batch test " + UUID.randomUUID(),
            examples
        );

        UUID versionId = UUID.fromString(created.id());
        var loaded = service.readVersion(versionId);

        assertEquals(80, created.trainingCount());
        assertEquals(20, created.validationCount());

        assertEquals(expected.training(), loaded.trainingExamples());
        assertEquals(expected.validation(), loaded.validationExamples());

        assertEquals(100, jdbc.queryForObject(
            "SELECT COUNT(*) FROM jarvis_dataset_examples WHERE version_id=?",
            Integer.class,
            versionId
        ));

        assertEquals(
            expected.fullSha256(),
            created.contentSha256()
        );
        assertEquals(
            expected.validationSha256(),
            created.validationSha256()
        );
    }


    @Test void concurrentVersionCreationProducesUniqueSequentialNumbers()
            throws Exception {
        var initial = service.create(
            "Concurrent dataset " + UUID.randomUUID(),
            samples()
        );

        UUID datasetId = UUID.fromString(initial.datasetId());

        var executor = java.util.concurrent.Executors.newFixedThreadPool(2);
        var ready = new java.util.concurrent.CountDownLatch(2);
        var start = new java.util.concurrent.CountDownLatch(1);

        try {
            java.util.concurrent.Callable<Integer> task = () -> {
                ready.countDown();

                if (!start.await(10, java.util.concurrent.TimeUnit.SECONDS)) {
                    throw new IllegalStateException("Start timeout");
                }

                return service.newVersion(
                    datasetId,
                    samples()
                ).versionNumber();
            };

            var first = executor.submit(task);
            var second = executor.submit(task);

            assertTrue(
                ready.await(10, java.util.concurrent.TimeUnit.SECONDS),
                "Both tasks should be ready"
            );

            start.countDown();

            int firstNumber = first.get(
                30, java.util.concurrent.TimeUnit.SECONDS
            );

            int secondNumber = second.get(
                30, java.util.concurrent.TimeUnit.SECONDS
            );

            assertEquals(
                java.util.Set.of(2, 3),
                java.util.Set.of(firstNumber, secondNumber)
            );

            var versions = service.versions(datasetId);

            assertEquals(3, versions.size());
            assertEquals(
                java.util.List.of(3, 2, 1),
                versions.stream()
                    .map(DatasetRepository.Version::versionNumber)
                    .toList()
            );

            Integer storedCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM jarvis_dataset_versions WHERE dataset_id=?",
                Integer.class,
                datasetId
            );

            assertEquals(3, storedCount);
        } finally {
            start.countDown();
            executor.shutdownNow();
            assertTrue(
                executor.awaitTermination(
                    10, java.util.concurrent.TimeUnit.SECONDS
                ),
                "Workers should terminate"
            );
        }
    }


    @Test void unknownDatasetCannotBeListedAsExisting() {
        UUID missing = UUID.randomUUID();

        IllegalArgumentException error = assertThrows(
            IllegalArgumentException.class,
            () -> service.versions(missing)
        );

        assertEquals("Unknown dataset", error.getMessage());
    }


    @Test void existingDatasetWithoutVersionsReturnsEmptyList() {
        UUID id = UUID.randomUUID();

        jdbc.update(
            "INSERT INTO jarvis_datasets(id, name, created_at) " +
            "VALUES (?, ?, CURRENT_TIMESTAMP)",
            id,
            "Empty dataset"
        );

        assertTrue(service.versions(id).isEmpty());
    }

    @Test void rejectsBadVersionWithoutInsertingPartialRows() {
        var dataset = service.create("Rollback " + UUID.randomUUID(), samples());
        UUID id = UUID.fromString(dataset.datasetId());
        assertThrows(IllegalArgumentException.class, () -> service.newVersion(id,
                List.of("a", "b", "c", "d", "a")));
        assertEquals(1, service.versions(id).size());
    }
}
