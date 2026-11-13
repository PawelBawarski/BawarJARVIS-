package pl.bawar.jarvis.research;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class RagSourcePreviewServiceTest {
    private final KnowledgeMemoryService memory = mock(KnowledgeMemoryService.class);
    private final SemanticMemoryService semantic = mock(SemanticMemoryService.class);
    private final RagSourcePreviewService service = new RagSourcePreviewService(semantic, memory);

    @Test void rejectsBlankAndOversizedQuestionsWithoutCallingModel() {
        assertThrows(IllegalArgumentException.class, () -> service.preview(" "));
        assertThrows(IllegalArgumentException.class, () -> service.preview("x".repeat(501)));
        assertThrows(IllegalArgumentException.class, () -> service.preview(null));
        verifyNoInteractions(semantic, memory);
    }

    @Test void reportsCurrentMatchesWithoutPretendingTheyAreModelCitations() {
        var first = new SemanticMemoryService.Hit(UUID.randomUUID(), "Angular", "https://example.org/angular",
            "Angular signals are reactive", 0.87, "semantic");
        var second = new SemanticMemoryService.Hit(UUID.randomUUID(), "Local PDF", "local://document/a",
            "Dependency injection", 0, "text");
        when(semantic.find(eq("Angular"), eq(memory))).thenReturn(List.of(first, second));
        var preview = service.preview(" Angular ");
        assertFalse(preview.snapshotOfAnswer());
        assertEquals("Angular", preview.query());
        assertEquals(2, preview.sources().size());
        assertEquals("semantic", preview.sources().get(0).method());
        assertEquals("https://example.org/angular", preview.sources().get(0).externalUrl());
        assertNull(preview.sources().get(1).externalUrl());
        assertTrue(preview.sources().get(1).local());
        verify(semantic).find("Angular", memory);
    }

    @Test void stripsUnsafeUrlsAndBoundsExcerpts() {
        var id = UUID.randomUUID();
        when(semantic.find("note", memory)).thenReturn(List.of(
            new SemanticMemoryService.Hit(id, "test", "javascript:alert(1)", "a".repeat(500), 0, "text")));
        var found = service.preview("note").sources().get(0);
        assertNull(found.externalUrl());
        assertEquals(360, found.excerpt().length());
        assertNull(RagSourcePreviewService.externalHttpUrl("https://person:secret@example.org/path"));
        assertNull(RagSourcePreviewService.externalHttpUrl("file:///etc/passwd"));
    }
}
