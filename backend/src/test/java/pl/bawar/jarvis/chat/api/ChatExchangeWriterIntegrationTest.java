package pl.bawar.jarvis.chat.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import pl.bawar.jarvis.persistence.chat.ChatPersistenceService;
import pl.bawar.jarvis.persistence.chat.ChatRole;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/** Uses isolated H2 + Flyway test database from BE 11.2. */
@SpringBootTest
class ChatExchangeWriterIntegrationTest {
    @Autowired ChatPersistenceService persistence;
    @Autowired ChatExchangeWriter writer;

    @Test
    void savesUserAndAssistantInOrder() {
        UUID id = persistence.createConversation("Integration test").id();
        try {
            var turn = writer.appendTurn(id, "Pytanie", "Odpowiedź");
            var saved = persistence.listMessages(id);
            assertEquals(2, saved.size());
            assertEquals(ChatRole.USER, saved.get(0).role());
            assertEquals(ChatRole.ASSISTANT, saved.get(1).role());
            assertEquals(turn.userMessage().id(), saved.get(0).id());
            assertEquals(turn.assistantMessage().id(), saved.get(1).id());
        } finally {
            persistence.deleteConversation(id);
        }
    }

    @Test
    void rollsBackBothMessagesWhenAssistantInsertFails() {
        UUID id = persistence.createConversation("Rollback test").id();
        try {
            assertThrows(IllegalArgumentException.class,
                    () -> writer.appendTurn(id, "User", " "));
            assertEquals(0, persistence.listMessages(id).size(),
                    "No half-written chat turn may survive");
        } finally {
            persistence.deleteConversation(id);
        }
    }
}
