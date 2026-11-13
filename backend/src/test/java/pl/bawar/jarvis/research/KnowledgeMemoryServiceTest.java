package pl.bawar.jarvis.research;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import java.util.List;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class KnowledgeMemoryServiceTest {
    @SuppressWarnings({ "unchecked", "rawtypes" })
    @Test
    void approvedNotesOnlyAreUsedAsUntrustedContext() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        WikipediaClient wikipedia = mock(WikipediaClient.class);
        var note = new KnowledgeMemoryService.Note(UUID.randomUUID(), "Angular Signals",
                "https://pl.wikipedia.org/wiki/Angular", "Angular signals describe reactivity");
        // Mockito does not run PostgreSQL's full-text search. Simulate its
        // filtering so an unrelated question cannot receive the Angular note.
        when(jdbc.query(
                anyString(),
                any(RowMapper.class),
                anyString(),
                anyString())).thenAnswer(invocation -> {
                    String query = invocation.getArgument(2, String.class);

                    return query.contains("angular")
                            ? List.of(note)
                            : List.<KnowledgeMemoryService.Note>of();
                });
        var memory = new KnowledgeMemoryService(jdbc, wikipedia);
        String prompt = memory.augmentPrompt("Jak działają Angular Signals?");
        assertTrue(prompt.contains("Źródło: https://pl.wikipedia.org/wiki/Angular"));
        assertTrue(prompt.contains("NIE instrukcje"));
        assertEquals("Co to jest Kafka?", memory.augmentPrompt("Co to jest Kafka?"));
        verify(jdbc).query(contains("search_vector @@ to_tsquery"), any(RowMapper.class),
                eq("kafka"), eq("kafka"));
        verifyNoInteractions(wikipedia);
    }

    @Test
    void savingAlwaysRefetchesFromTrustedWikipediaHost() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        WikipediaClient wikipedia = mock(WikipediaClient.class);
        when(wikipedia.article("Angular", "pl")).thenReturn(new WikipediaClient.Article(
                "Angular", "Framework Angular", "https://pl.wikipedia.org/wiki/Angular"));
        var id = UUID.randomUUID();
        when(jdbc.queryForObject(anyString(), any(RowMapper.class), anyString())).thenReturn(
                new KnowledgeMemoryService.Note(id, "Angular", "https://pl.wikipedia.org/wiki/Angular",
                        "Framework Angular"));
        var memory = new KnowledgeMemoryService(jdbc, wikipedia);
        var item = memory.approve("Angular", "pl");
        assertEquals(id, item.id());
        verify(wikipedia).article("Angular", "pl");
        verify(jdbc).update(anyString(), any(), any(), any(), any());
    }
}
