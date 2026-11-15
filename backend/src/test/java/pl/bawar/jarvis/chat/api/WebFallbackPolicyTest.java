package pl.bawar.jarvis.chat.api;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class WebFallbackPolicyTest {
    @Test void searchesWhenTheModelExplicitlyDoesNotKnow() {
        assertTrue(WebFallbackPolicy.shouldSearch("Kto jest prezesem?", "Nie wiem, kto teraz pełni tę funkcję."));
        assertTrue(WebFallbackPolicy.shouldSearch("Search the web for this", "Nie mam danych"));
    }
    @Test void doesNotExposeSecretBearingQuestionsOrSearchNormalAnswers() {
        assertFalse(WebFallbackPolicy.shouldSearch("api_key=topsecret sprawdź online", "Nie wiem"));
        assertFalse(WebFallbackPolicy.shouldSearch("Co to Angular?", "To framework frontendowy."));
        assertFalse(WebFallbackPolicy.shouldSearch("X".repeat(451), "Nie wiem"));
    }
}
