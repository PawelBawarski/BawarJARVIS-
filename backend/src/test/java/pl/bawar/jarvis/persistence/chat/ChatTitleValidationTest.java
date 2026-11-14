package pl.bawar.jarvis.persistence.chat;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ChatTitleValidationTest {

    private ChatConversationRepository conversations;
    private ChatMessageRepository messages;
    private ChatPersistenceService service;

    @BeforeEach
    void setup() {
        conversations = mock(ChatConversationRepository.class);
        messages = mock(ChatMessageRepository.class);

        service = new ChatPersistenceService(
                conversations, messages);
    }

    @Test
    void rejectsNullTitleBeforeDatabaseInsert() {
        assertThrows(IllegalArgumentException.class,
                () -> service.createConversation(null));

        verifyNoInteractions(conversations, messages);
    }

    @Test
    void rejectsEmptyTitleBeforeDatabaseInsert() {
        assertThrows(IllegalArgumentException.class,
                () -> service.createConversation(""));

        verifyNoInteractions(conversations, messages);
    }

    @Test
    void rejectsWhitespaceOnlyTitle() {
        assertThrows(IllegalArgumentException.class,
                () -> service.createConversation("   \t  "));

        verifyNoInteractions(conversations, messages);
    }

    @Test
    void acceptsExactly200Characters() {
        String title = "a".repeat(200);

        service.createConversation(title);

        verify(conversations).create(title);
        verifyNoInteractions(messages);
    }

    @Test
    void rejects201CharactersBeforeDatabaseInsert() {
        String title = "a".repeat(201);

        assertThrows(IllegalArgumentException.class,
                () -> service.createConversation(title));

        verifyNoInteractions(conversations, messages);
    }

    @Test
    void stripsWhitespaceBeforeCreatingConversation() {
        service.createConversation("  Moj czat  ");

        verify(conversations).create("Moj czat");
        verifyNoInteractions(messages);
    }

    @Test
    void rejectsInvalidRenameWithoutDatabaseUpdate() {
        UUID id = UUID.randomUUID();

        assertThrows(IllegalArgumentException.class,
                () -> service.renameConversation(id, " "));

        assertThrows(IllegalArgumentException.class,
                () -> service.renameConversation(id, "x".repeat(201)));

        verifyNoInteractions(conversations, messages);
    }

    @Test
    void renamesUsingNormalizedTitle() {
        UUID id = UUID.randomUUID();
        ChatConversation expected = mock(ChatConversation.class);

        when(conversations.rename(id, "Nowa nazwa"))
                .thenReturn(Optional.of(expected));

        ChatConversation actual =
                service.renameConversation(id, "  Nowa nazwa  ");

        assertSame(expected, actual);

        verify(conversations).rename(id, "Nowa nazwa");
        verifyNoInteractions(messages);
    }

    @Test
    void rejectsOverlongTitleEvenWhenTrimmedLengthWouldFit() {
        String title = " " + "a".repeat(199) + " ";

        assertEquals(201, title.length());

        assertThrows(IllegalArgumentException.class,
                () -> service.createConversation(title));

        verifyNoInteractions(conversations, messages);
    }
}
