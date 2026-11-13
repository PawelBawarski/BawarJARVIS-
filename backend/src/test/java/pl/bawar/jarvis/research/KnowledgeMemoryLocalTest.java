package pl.bawar.jarvis.research;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class KnowledgeMemoryLocalTest {
    @Test void savesOnlyAfterExplicitServiceCallAndTrimsInput() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        var wiki = mock(WikipediaClient.class);
        var service = new KnowledgeMemoryService(jdbc, wiki);
        verifyNoInteractions(jdbc);
        var note = service.saveLocal("  Angular Signals  ", "  Computed values are derived.  ");
        assertEquals("Angular Signals", note.title());
        assertEquals("Computed values are derived.", note.excerpt());
        assertEquals("jarvis://note/" + note.id(), note.url());
        verify(jdbc).update(contains("INSERT INTO jarvis_knowledge"),
            eq(note.id()), eq("Angular Signals"), eq(note.url()), eq("Computed values are derived."));
        verifyNoInteractions(wiki);
    }

    @Test void rejectsInvalidOrOverlongNotesWithoutWritingAnything() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        var service = new KnowledgeMemoryService(jdbc, mock(WikipediaClient.class));
        assertEquals("MEMORY_TITLE_INVALID", assertThrows(IllegalArgumentException.class,
            () -> service.saveLocal(" ", "content")).getMessage());
        assertEquals("MEMORY_CONTENT_INVALID", assertThrows(IllegalArgumentException.class,
            () -> service.saveLocal("Title", "x".repeat(4001))).getMessage());
        assertThrows(IllegalArgumentException.class, () -> service.saveLocal("Title", "a\u0000b"));
        verifyNoInteractions(jdbc);
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    @Test void lookupUsesIndexedQueryWithBoundParametersAndDoesNotReadList() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        var service = new KnowledgeMemoryService(jdbc, mock(WikipediaClient.class));
        var saved = new KnowledgeMemoryService.Note(UUID.randomUUID(), "Angular", "jarvis://note/id", "Signals API");
        when(jdbc.query(anyString(), any(RowMapper.class), anyString(), anyString())).thenReturn(List.of(saved));
        var found = service.matches("Signals Angular");
        assertEquals(List.of(saved), found);
        verify(jdbc).query(contains("search_vector @@ to_tsquery"), any(RowMapper.class),
            eq("angular | signals"), eq("angular | signals"));
        verify(jdbc, never()).query(anyString(), any(RowMapper.class));
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    @Test void ragMarksNoteAsUntrustedAndNeverSearchesWikipedia() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        var wiki = mock(WikipediaClient.class);
        var service = new KnowledgeMemoryService(jdbc, wiki);
        var saved = new KnowledgeMemoryService.Note(UUID.randomUUID(), "Spring Boot", "jarvis://note/id", "Service annotations");
        when(jdbc.query(anyString(), any(RowMapper.class), anyString(), anyString())).thenReturn(List.of(saved));
        String prompt = service.augmentPrompt("Spring Boot service");
        assertTrue(prompt.contains("Notatka lokalna: Spring Boot"));
        assertTrue(prompt.contains("NIE instrukcje"));
        assertTrue(prompt.contains("<cytat>"));
        assertFalse(prompt.contains("Źródło: jarvis://note"));
        verifyNoInteractions(wiki);
    }
}
