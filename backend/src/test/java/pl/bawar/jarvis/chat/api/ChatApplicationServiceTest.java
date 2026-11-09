package pl.bawar.jarvis.chat.api;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import pl.bawar.jarvis.persistence.chat.ChatConversation;
import pl.bawar.jarvis.persistence.chat.ChatPersistenceService;

import java.time.Instant;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ChatApplicationServiceTest {
    private ChatPersistenceService persistence;
    private LocalLlmClient llm;
    private ChatExchangeWriter writer;
    private ChatApplicationService service;
    private final UUID id = UUID.randomUUID();

    @BeforeEach void setup() {
        persistence = mock(ChatPersistenceService.class);
        llm = mock(LocalLlmClient.class);
        writer = mock(ChatExchangeWriter.class);
        service = new ChatApplicationService(persistence, llm, writer);
        when(persistence.getConversation(id)).thenReturn(new ChatConversation(id, "Test", Instant.EPOCH, Instant.EPOCH));
        when(persistence.listMessages(id)).thenReturn(List.of());
    }

    @Test void getsLlmReplyAndSavesTurn() {
        when(llm.reply(List.of(), "Cześć")).thenReturn("Cześć! W czym pomóc?");
        service.sendMessage(id, " Cześć ");
        verify(writer).appendTurn(id, "Cześć", "Cześć! W czym pomóc?");
    }
    @Test void keepsMessageIfLlmUnavailable() {
        when(llm.reply(List.of(), "Czy jesteś?")).thenThrow(new LocalLlmUnavailableException("Unavailable"));
        assertThrows(LocalLlmUnavailableException.class, () -> service.sendMessage(id, "Czy jesteś?"));
        verifyNoInteractions(writer);
    }
    @Test void neverInvokesLlmForMissingChat() {
        when(persistence.getConversation(id)).thenThrow(new NoSuchElementException("missing"));
        assertThrows(NoSuchElementException.class, () -> service.sendMessage(id, "hello"));
        verifyNoInteractions(llm, writer);
    }
    @Test void rejectsBlankAndLongMessages() {
        assertThrows(IllegalArgumentException.class, () -> service.sendMessage(id, " "));
        assertThrows(IllegalArgumentException.class, () -> service.sendMessage(id, "a".repeat(20001)));
        verifyNoInteractions(llm, writer);
    }
    @Test void missingDeleteIsNotFound() {
        when(persistence.deleteConversation(id)).thenReturn(false);
        assertThrows(NoSuchElementException.class, () -> service.deleteConversation(id));
    }
}
