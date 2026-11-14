package pl.bawar.jarvis.persistence.chat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional  // Po kazdym tescie dane sa wycofywane.
class ChatPersistenceServiceTest {
    @Autowired
    ChatPersistenceService chats;

    @Test
    void savesAndReadsConversation() {
        ChatConversation created = chats.createConversation("  Nowy czat  ");
        assertEquals("Nowy czat", chats.getConversation(created.id()).title());
        assertTrue(chats.listConversations().stream()
                .anyMatch(chat -> chat.id().equals(created.id())));
    }

    @Test
    void persistsUserAndAssistantMessagesInOrder() {
        UUID id = chats.createConversation("Rozmowa z Jarvisem").id();
        chats.appendMessage(id, ChatRole.USER, "Cześć!");
        chats.appendMessage(id, ChatRole.ASSISTANT, "Witaj!");

        List<ChatMessage> messages = chats.listMessages(id);
        assertEquals(2, messages.size());
        assertEquals(ChatRole.USER, messages.get(0).role());
        assertEquals("Cześć!", messages.get(0).content());
        assertEquals(ChatRole.ASSISTANT, messages.get(1).role());
        assertTrue(messages.get(0).order() < messages.get(1).order());
    }

    @Test
    void removesMessagesWhenConversationIsDeleted() {
        UUID id = chats.createConversation("Do skasowania").id();
        chats.appendMessage(id, ChatRole.USER, "Test");

        assertTrue(chats.deleteConversation(id));
        assertThrows(NoSuchElementException.class,
                () -> chats.getConversation(id));
        assertThrows(NoSuchElementException.class,
                () -> chats.listMessages(id));
    }

    @Test
    void rejectsEmptyAndOversizedMessages() {
        UUID id = chats.createConversation("Walidacja").id();
        assertThrows(IllegalArgumentException.class,
                () -> chats.appendMessage(id, ChatRole.USER, "   "));
        assertThrows(IllegalArgumentException.class,
                () -> chats.appendMessage(id, ChatRole.USER, "a".repeat(20_001)));
        assertTrue(chats.listMessages(id).isEmpty());
    }


    @Test
    void insertReturnsPersistedMessageWithDatabaseOrder() {
        UUID conversationId = chats.createConversation(
            "PostgreSQL RETURNING"
        ).id();

        ChatMessage first = chats.appendMessage(
            conversationId, ChatRole.USER, "Pierwsza wiadomość"
        );

        ChatMessage second = chats.appendMessage(
            conversationId, ChatRole.ASSISTANT, "Druga wiadomość"
        );

        assertNotNull(first.id());
        assertNotNull(second.id());
        assertEquals(conversationId, first.conversationId());
        assertEquals(conversationId, second.conversationId());
        assertEquals(ChatRole.USER, first.role());
        assertEquals(ChatRole.ASSISTANT, second.role());
        assertEquals("Pierwsza wiadomość", first.content());
        assertEquals("Druga wiadomość", second.content());
        assertTrue(first.order() > 0);
        assertTrue(second.order() > first.order());

        List<ChatMessage> stored = chats.listMessages(conversationId);

        assertEquals(2, stored.size());
        assertEquals(first, stored.get(0));
        assertEquals(second, stored.get(1));
    }

    @Test
    void rejectsUnknownConversation() {
        UUID id = UUID.randomUUID();
        assertThrows(NoSuchElementException.class,
                () -> chats.appendMessage(id, ChatRole.USER, "Test"));
    }
}
