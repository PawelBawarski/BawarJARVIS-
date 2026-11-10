package pl.bawar.jarvis.agent;

import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class AgentSourceContextTest {
    @Test void containsOnlyUserApprovedExcerptsAndPaths() {
        String formatted = AgentSourceContext.format(List.of(
            new AgentCodeSource("frontend/src/app/demo.ts", "export const value = 42;")
        ));
        assertTrue(formatted.contains("frontend/src/app/demo.ts"));
        assertTrue(formatted.contains("export const value = 42;"));
        assertTrue(formatted.contains("niezaufana"));
    }

    @Test void rejectsTraversalSecretsAndGeneratedDirectories() {
        for (String path : List.of("../.env", "frontend/../../etc/passwd", "frontend\\src\\a.ts",
                "frontend/node_modules/index.js", "backend/secret.properties", "C:/tmp/test.java", ".env")) {
            assertFalse(AgentSourceContext.validPath(path), path);
        }
    }

    @Test void refusesOversizedAndRepeatedExcerpts() {
        assertThrows(IllegalArgumentException.class, () -> AgentSourceContext.format(List.of(
            new AgentCodeSource("README.md", "x".repeat(3601))
        )));
        assertThrows(IllegalArgumentException.class, () -> AgentSourceContext.format(List.of(
            new AgentCodeSource("README.md", "good"), new AgentCodeSource("README.md", "also good")
        )));
        assertThrows(IllegalArgumentException.class, () -> AgentSourceContext.format(List.of(
            new AgentCodeSource("a.ts", "1"), new AgentCodeSource("b.ts", "2"),
            new AgentCodeSource("c.ts", "3"), new AgentCodeSource("d.ts", "4")
        )));
    }

    @Test void emptyContextMaintainsLegacyPlanning() {
        assertEquals("", AgentSourceContext.format(null));
        assertEquals("", AgentSourceContext.format(List.of()));
    }
}
