package pl.bawar.jarvis.research;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class KnowledgeRankerTest {
    @Test void matchesRelevantTokensAndIgnoresUnrelatedSources() {
        assertTrue(KnowledgeRanker.score("Angular Signals", "Angular Signals", "Reactivity") >= 6);
        assertEquals(0, KnowledgeRanker.score("Angular Signals", "PostgreSQL", "Database indexes"));
    }
    @Test void languageAndHtmlValidation() {
        assertDoesNotThrow(() -> WikipediaClient.validateLanguage("pl"));
        assertThrows(IllegalArgumentException.class, () -> WikipediaClient.validateLanguage("evil.com"));
        assertEquals("Angular Signals", WikipediaClient.clean("<span>Angular</span> Signals"));
    }
}
