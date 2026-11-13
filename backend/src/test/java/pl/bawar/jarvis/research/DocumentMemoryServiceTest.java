package pl.bawar.jarvis.research;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.BatchPreparedStatementSetter;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;

class DocumentMemoryServiceTest {
    @Test void validatesNameAndExtension() {
        assertEquals("MEMORY_DOC_INVALID_NAME", assertThrows(IllegalArgumentException.class,
            () -> DocumentMemoryService.safeFileName("../secret.txt")).getMessage());
        assertEquals("MEMORY_DOC_UNSUPPORTED_FORMAT", assertThrows(IllegalArgumentException.class,
            () -> DocumentMemoryService.kind("script.exe")).getMessage());
    }

    @Test void explicitlyImportsUtf8TextIntoDocumentAndKnowledge() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        var service = new DocumentMemoryService(jdbc);
        var file = new MockMultipartFile("file", "readme.md", "text/markdown",
            "# Projekt\nAngular Signals i Spring Boot".getBytes(StandardCharsets.UTF_8));
        var info = service.importDocument(file);
        assertEquals("md", info.kind());
        assertEquals(1, info.chunkCount());
        verify(jdbc).update(startsWith("INSERT INTO jarvis_documents"), any(Object[].class));
        verify(jdbc).batchUpdate(startsWith("INSERT INTO jarvis_knowledge"), any(BatchPreparedStatementSetter.class));
    }

    @Test void rejectsUnsupportedAndMalformedFormatsBeforeDatabaseWrite() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        var service = new DocumentMemoryService(jdbc);
        assertEquals("MEMORY_DOC_UNSUPPORTED_FORMAT", assertThrows(IllegalArgumentException.class,
            () -> service.importDocument(new MockMultipartFile("file", "script.exe", "application/octet-stream", new byte[]{1}))).getMessage());
        assertEquals("MEMORY_DOC_INVALID_PDF", assertThrows(IllegalArgumentException.class,
            () -> service.importDocument(new MockMultipartFile("file", "fake.pdf", "application/pdf", "not pdf".getBytes(StandardCharsets.UTF_8)))).getMessage());
        verifyNoInteractions(jdbc);
    }

    @Test void removalUsesForeignKeyCascade() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        var service = new DocumentMemoryService(jdbc);
        UUID id = UUID.randomUUID();
        when(jdbc.update(eq("DELETE FROM jarvis_documents WHERE id=?"), eq(id))).thenReturn(1);
        assertTrue(service.remove(id));
    }
}
