package pl.bawar.jarvis.research;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@SpringBootTest
@Transactional
class SemanticMemoryConcurrencyIntegrationTest {

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    KnowledgeMemoryService memory;

    @Test
    void changedSourceCannotStoreOutdatedEmbedding() {
        LocalEmbeddingClient embedding = mock(LocalEmbeddingClient.class);

        String model = "m02-concurrency-model";
        String title = "M02 semantic " + UUID.randomUUID();

        var note = memory.saveLocal(
            title,
            "Original document content"
        );

        when(embedding.enabled()).thenReturn(true);
        when(embedding.model()).thenReturn(model);

        float[] vector = new float[SemanticVector.MIN_DIMS];
        vector[0] = 1.0f;

        when(embedding.embedDocument(anyString(), anyString()))
            .thenAnswer(invocation -> {
                String currentTitle = invocation.getArgument(0);

                // Simulate editing the note while the embedding is
                // being generated from its previous content.
                if (title.equals(currentTitle)) {
                    jdbc.update("""
                        UPDATE jarvis_knowledge
                        SET excerpt = ?
                        WHERE id = ?
                        """, "Updated document content", note.id());
                }

                return vector.clone();
            });

        var semantic = new SemanticMemoryService(jdbc, embedding);

        semantic.indexNextBatch();

        Integer staleCount = jdbc.queryForObject("""
            SELECT COUNT(*)
            FROM jarvis_knowledge_embeddings
            WHERE knowledge_id = ?
            """, Integer.class, note.id());

        assertEquals(0, staleCount,
            "Outdated embedding must not be stored");

        // On retry, the latest source content should be indexed.
        semantic.indexNextBatch();

        String storedHash = jdbc.queryForObject("""
            SELECT source_hash
            FROM jarvis_knowledge_embeddings
            WHERE knowledge_id = ?
            """, String.class, note.id());

        assertEquals(
            SemanticVector.sourceHash(
                title, "Updated document content"
            ),
            storedHash
        );
    }
}
