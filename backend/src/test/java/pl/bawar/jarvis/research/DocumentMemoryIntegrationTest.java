package pl.bawar.jarvis.research;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class DocumentMemoryIntegrationTest {

    @Autowired
    DocumentMemoryService documents;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    PlatformTransactionManager transactionManager;

    private MockMultipartFile document() {
        String unique = UUID.randomUUID().toString();

        return new MockMultipartFile(
            "file",
            "m02-" + unique + ".txt",
            "text/plain",
            ("J.A.R.V.I.S. M02 integration test: " + unique +
                " Angular Spring Boot PostgreSQL.")
                .getBytes(StandardCharsets.UTF_8)
        );
    }

    private int documentCount(UUID id) {
        return jdbc.queryForObject(
            "SELECT COUNT(*) FROM jarvis_documents WHERE id=?",
            Integer.class,
            id
        );
    }

    private int chunkCount(UUID id) {
        return jdbc.queryForObject(
            "SELECT COUNT(*) FROM jarvis_knowledge WHERE document_id=?",
            Integer.class,
            id
        );
    }

    @Test
    void importsDocumentAndRemovesChunksWithCascade() {
        var imported = documents.importDocument(document());

        try {
            assertNotNull(imported.id());
            assertTrue(imported.chunkCount() > 0);

            assertEquals(1, documentCount(imported.id()));
            assertEquals(
                imported.chunkCount(),
                chunkCount(imported.id())
            );

            assertTrue(documents.remove(imported.id()));

            assertEquals(0, documentCount(imported.id()));
            assertEquals(0, chunkCount(imported.id()));
        } finally {
            // Cleanup is safe even if an assertion fails.
            documents.remove(imported.id());
        }
    }

    @Test
    void rollbackRemovesDocumentAndAllItsChunks() {
        var transaction = new TransactionTemplate(transactionManager);
        var importedId = new AtomicReference<UUID>();

        assertThrows(
            IllegalStateException.class,
            () -> transaction.executeWithoutResult(status -> {
                var imported = documents.importDocument(document());

                importedId.set(imported.id());

                assertEquals(1, documentCount(imported.id()));
                assertEquals(
                    imported.chunkCount(),
                    chunkCount(imported.id())
                );

                // Simulate failure in the surrounding transaction.
                throw new IllegalStateException("M02_ROLLBACK_TEST");
            })
        );

        UUID id = importedId.get();

        assertNotNull(id);
        assertEquals(0, documentCount(id));
        assertEquals(0, chunkCount(id));
    }
}
