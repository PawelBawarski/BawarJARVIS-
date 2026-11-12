package pl.bawar.jarvis.agent;

import org.junit.jupiter.api.Test;
import pl.bawar.jarvis.chat.api.LocalLlmClient;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AgentPatchPreviewServiceTest {
    private final LocalLlmClient llm = mock(LocalLlmClient.class);
    private final AgentPatchPreviewService service = new AgentPatchPreviewService(llm);
    private final AgentCodeSource source = new AgentCodeSource("frontend/src/app/sample.ts", "export const x = 1;");

    @Test void returnsReadOnlyPreviewOfExactlyTheApprovedSource() {
        when(llm.reply(eq(List.of()), anyString())).thenReturn(
            "<JARVIS_REPLACEMENT>\nexport const x = 2;\n</JARVIS_REPLACEMENT>");
        var result = service.preview("Zmień wartość", source);
        assertEquals("export const x = 1;", result.original());
        assertEquals("export const x = 2;", result.proposed());
        assertTrue(result.diff().contains("-export const x = 1;"));
        assertTrue(result.diff().contains("+export const x = 2;"));
        assertEquals(1, result.review().addedLines());
        assertEquals(1, result.review().removedLines());
        assertTrue(result.review().warnings().isEmpty());
        verify(llm).reply(eq(List.of()), argThat(prompt -> prompt.contains(source.content()) && prompt.contains(source.relativePath())));
    }

    @Test void rejectsUnsafePathsBeforeCallingQwen() {
        assertThrows(IllegalArgumentException.class, () -> service.preview("Zmień", new AgentCodeSource("../secrets.env", "PASS=1")));
        verifyNoInteractions(llm);
    }

    @Test void rejectsEmptyAndOversizedInputs() {
        assertThrows(IllegalArgumentException.class, () -> service.preview(" ", source));
        assertThrows(IllegalArgumentException.class, () -> service.preview("z".repeat(1201), source));
        assertThrows(IllegalArgumentException.class, () -> service.preview("Zmień", new AgentCodeSource(source.relativePath(), "A".repeat(3601))));
        verifyNoInteractions(llm);
    }

    @Test void rejectsMalformedOrMultipleModelPayloads() {
        when(llm.reply(eq(List.of()), anyString())).thenReturn("nie mam zmian");
        assertThrows(IllegalStateException.class, () -> service.preview("Zmień", source));
        when(llm.reply(eq(List.of()), anyString())).thenReturn("<JARVIS_REPLACEMENT>x</JARVIS_REPLACEMENT><JARVIS_REPLACEMENT>y</JARVIS_REPLACEMENT>");
        assertThrows(IllegalStateException.class, () -> service.preview("Zmień", source));
    }

    @Test void rejectsNoOpAndOversizedReplacement() {
        when(llm.reply(eq(List.of()), anyString())).thenReturn("<JARVIS_REPLACEMENT>\nexport const x = 1;\n</JARVIS_REPLACEMENT>");
        assertThrows(IllegalStateException.class, () -> service.preview("Zmień", source));
        when(llm.reply(eq(List.of()), anyString())).thenReturn("<JARVIS_REPLACEMENT>" + "x".repeat(8001) + "</JARVIS_REPLACEMENT>");
        assertThrows(IllegalStateException.class, () -> service.preview("Zmień", source));
    }

    @Test void changeAtEndHasCorrectLineNumbersAndContext() {
        var diff = AgentPatchDiff.unified("src/x.ts", "a\nb\nc\nd\ne", "a\nb\nc\nd\nf");
        assertTrue(diff.contains("@@ -2,4 +2,4 @@"));
        assertTrue(diff.contains("-e\n+f"));
    }
}
