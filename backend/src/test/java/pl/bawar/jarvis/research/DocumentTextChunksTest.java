package pl.bawar.jarvis.research;

import static org.junit.jupiter.api.Assertions.*;
import java.util.List;
import org.junit.jupiter.api.Test;

class DocumentTextChunksTest {
    @Test void keepsShortInputUnchanged() {
        assertEquals(List.of("Angular signals and Java records."), DocumentTextChunks.split("  Angular signals and Java records.  "));
    }
    @Test void splitsLongInputWithBoundedOverlap() {
        List<String> chunks = DocumentTextChunks.split("Angular ".repeat(800));
        assertTrue(chunks.size() > 2);
        assertTrue(chunks.stream().allMatch(chunk -> !chunk.isBlank() && chunk.length() <= 1100));
        assertTrue(chunks.get(0).endsWith("Angular") || chunks.get(0).endsWith(" ") || chunks.get(0).endsWith("Angular ".strip()));
    }
    @Test void rejectsEmptyAndTooLargeText() {
        assertEquals("MEMORY_DOC_TEXT_EMPTY", assertThrows(IllegalArgumentException.class,
            () -> DocumentTextChunks.split("   ")).getMessage());
        assertEquals("MEMORY_DOC_TEXT_TOO_LARGE", assertThrows(IllegalArgumentException.class,
            () -> DocumentTextChunks.split("x".repeat(150_001))).getMessage());
    }
}
