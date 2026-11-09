package pl.bawar.jarvis.chat.api;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import pl.bawar.jarvis.brain.training.GenerationResult;
import pl.bawar.jarvis.persistence.chat.ChatConversation;
import pl.bawar.jarvis.persistence.chat.ChatPersistenceService;
import pl.bawar.jarvis.runtime.JarvisModelService;
import pl.bawar.jarvis.runtime.ModelStatus;

import java.time.Instant;
import java.util.NoSuchElementException;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ChatApplicationServiceTest {
    private ChatPersistenceService persistence;
    private JarvisModelService model;
    private ChatExchangeWriter writer;
    private ChatApplicationService service;
    private final UUID conversationId = UUID.randomUUID();

    @BeforeEach
    void setup() {
        persistence = mock(ChatPersistenceService.class);
        model = mock(JarvisModelService.class);
        writer = mock(ChatExchangeWriter.class);
        service = new ChatApplicationService(persistence, model, writer);
        when(persistence.getConversation(conversationId)).thenReturn(
                new ChatConversation(conversationId, "Test", Instant.EPOCH, Instant.EPOCH));
        when(model.status()).thenReturn(new ModelStatus(20, 128, 0, false, false));
    }

    @Test
    void sendsToModelAndWritesEntireExchange() {
        when(model.generate("ala", 32, 0.0, 42L))
                .thenReturn(new GenerationResult("ala ma kota", 8, false));
        service.sendMessage(conversationId, " ala ");
        verify(writer).appendTurn(conversationId, "ala", "ma kota");
    }

    @Test
    void truncatesOnlyInferencePromptButPersistsFullMessage() {
        String longInput = "a".repeat(200);
        String suffix = "a".repeat(95);
        when(model.generate(suffix, 32, 0.0, 42L))
                .thenReturn(new GenerationResult(suffix + "b", 1, false));
        service.sendMessage(conversationId, longInput);
        verify(writer).appendTurn(conversationId, longInput, "b");
    }

    @Test
    void doesNotWriteAnythingWhenModelFails() {
        when(model.generate(anyString(), eq(32), eq(0.0), eq(42L)))
                .thenThrow(new IllegalArgumentException("Unknown character"));
        assertThrows(IllegalArgumentException.class,
                () -> service.sendMessage(conversationId, "🧪"));
        verifyNoInteractions(writer);
    }

    @Test
    void doesNotGenerateForUnknownConversation() {
        when(persistence.getConversation(conversationId))
                .thenThrow(new NoSuchElementException("Missing"));
        assertThrows(NoSuchElementException.class,
                () -> service.sendMessage(conversationId, "abc"));
        verify(model, never()).generate(anyString(), anyInt(), anyDouble(), anyLong());
        verifyNoInteractions(writer);
    }

    @Test
    void rejectsEmptyOrTooLongInput() {
        assertThrows(IllegalArgumentException.class,
                () -> service.sendMessage(conversationId, " "));
        assertThrows(IllegalArgumentException.class,
                () -> service.sendMessage(conversationId, "a".repeat(20_001)));
        verifyNoInteractions(writer);
    }

    @Test
    void returnsHonestNoticeForEmptyGeneration() {
        when(model.generate("a", 32, 0.0, 42L))
                .thenReturn(new GenerationResult("a", 0, true));
        service.sendMessage(conversationId, "a");
        verify(writer).appendTurn(eq(conversationId), eq("a"),
                contains("Model nie wygenerował odpowiedzi"));
    }

    @Test
    void suffixDoesNotBreakUtf16SurrogatePairs() {
        assertEquals("🧪abc", ChatApplicationService.suffixByCodePoints("x🧪abc", 4));
    }

    @Test
    void deletingUnknownConversationReturnsMissing() {
        when(persistence.deleteConversation(conversationId)).thenReturn(false);
        assertThrows(NoSuchElementException.class,
                () -> service.deleteConversation(conversationId));
    }
}
