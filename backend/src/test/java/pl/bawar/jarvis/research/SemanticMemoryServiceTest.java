package pl.bawar.jarvis.research;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class SemanticMemoryServiceTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final LocalEmbeddingClient embedding = mock(LocalEmbeddingClient.class);
    private final KnowledgeMemoryService knowledge = mock(KnowledgeMemoryService.class);
    private final SemanticMemoryService service = new SemanticMemoryService(jdbc, embedding);

    @Test void disabledIndexIsRejectedWithoutCallingModelOrDatabase() {
        when(embedding.enabled()).thenReturn(false);
        assertEquals("SEMANTIC_DISABLED", assertThrows(IllegalArgumentException.class,
            service::indexNextBatch).getMessage());
        verifyNoInteractions(jdbc);
    }

    @Test void searchFallsBackToLexicalWhenEmbeddingsAreDisabled() {
        when(embedding.enabled()).thenReturn(false);
        var note = new KnowledgeMemoryService.Note(UUID.randomUUID(), "Angular", "jarvis://note/1", "Signals");
        when(knowledge.matches("angular signals")).thenReturn(List.of(note));
        var hits = service.find("angular signals", knowledge);
        assertEquals(1, hits.size());
        assertEquals("text", hits.getFirst().method());
        verify(embedding, never()).embedQuery(anyString());
        verifyNoInteractions(jdbc);
    }

    @Test void failedLocalModelFallsBackToLexical() {
        when(embedding.enabled()).thenReturn(true);
        when(embedding.embedQuery(anyString())).thenThrow(new LocalEmbeddingClient.SemanticUnavailableException());
        var note = new KnowledgeMemoryService.Note(UUID.randomUUID(), "Kafka", "jarvis://note/2", "Brokers");
        when(knowledge.matches("message broker")).thenReturn(List.of(note));
        assertEquals("text", service.find("message broker", knowledge).getFirst().method());
        verifyNoInteractions(jdbc);
    }

    @Test void invalidQueryDoesNotReachDatabaseOrModel() {
        assertEquals("SEMANTIC_QUERY_INVALID", assertThrows(IllegalArgumentException.class,
            () -> service.find(" ", knowledge)).getMessage());
        verifyNoInteractions(jdbc, embedding);
    }
}
