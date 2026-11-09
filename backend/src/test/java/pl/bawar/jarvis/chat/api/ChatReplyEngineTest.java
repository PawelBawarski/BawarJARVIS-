package pl.bawar.jarvis.chat.api;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class ChatReplyEngineTest {
    @TempDir Path temp;

    private ChatReplyEngine engine() {
        return new ChatReplyEngine(temp.resolve("knowledge/facts.properties"));
    }

    @Test void greetingIsReadablePolish() {
        assertTrue(engine().reply("Cześć!").startsWith("Cześć!"));
    }

    @Test void arithmeticHonorsPrecedenceAndParentheses() {
        assertEquals("Wynik: 20", engine().reply("Oblicz (2+3)*4"));
        assertEquals("Wynik: 7", engine().reply("2+10/2"));
        assertEquals("Wynik: 5", engine().reply("ile to 2,5*2?"));
        assertEquals("Wynik: -8", engine().reply("oblicz -4*2"));
    }

    @Test void invalidMathIsNotExecutedAsCode() {
        assertTrue(engine().reply("oblicz 2/0").contains("Nie mogę"));
        assertTrue(engine().reply("oblicz 2+abc").contains("Nie mam jeszcze"));
        assertTrue(engine().reply("oblicz (2+3").contains("Nie mogę"));
    }

    @Test void explicitApprovalIsPersisted() {
        ChatReplyEngine assistant = engine();
        assertTrue(assistant.reply("zapamiętaj: Co to jest Angular? => Framework frontendowy").contains("Zapamiętałem"));
        assertEquals("Framework frontendowy", engine().reply("CO TO JEST ANGULAR?"));
    }

    @Test void noAutomaticLearningOrFabricatedAnswers() {
        String unknown = engine().reply("Jaka jutro pogoda w Koszalinie?");
        assertTrue(unknown.contains("Nie mam jeszcze wiarygodnej odpowiedzi"));
        assertTrue(unknown.contains("Nie przeszukuję jeszcze internetu"));
    }

    @Test void rejectsSecretAndOversizedMemory() {
        assertTrue(engine().reply("zapamiętaj: mój token => token=secret").contains("Nie zapisano"));
        assertTrue(engine().reply("zapamiętaj: pytanie => " + "x".repeat(1201)).contains("Nie zapisano"));
    }
}
