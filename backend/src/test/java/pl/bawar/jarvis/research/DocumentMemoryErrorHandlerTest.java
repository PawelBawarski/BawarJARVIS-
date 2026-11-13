package pl.bawar.jarvis.research;

import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.Test;

class DocumentMemoryErrorHandlerTest {
    @Test void exposesOnlyKnownValidationCodes() {
        var handler = new DocumentMemoryErrorHandler();
        var badInput = handler.invalidDocument(new IllegalArgumentException("MEMORY_DOC_INVALID_PDF"));
        assertEquals(400, badInput.getStatusCode().value());
        assertEquals("MEMORY_DOC_INVALID_PDF", badInput.getBody().get("code"));
        var conflict = handler.invalidDocument(new IllegalArgumentException("MEMORY_DOC_ALREADY_IMPORTED"));
        assertEquals(409, conflict.getStatusCode().value());
        var sanitized = handler.invalidDocument(new IllegalArgumentException("sensitive payload"));
        assertEquals("MEMORY_DOC_INVALID", sanitized.getBody().get("code"));
    }
}
