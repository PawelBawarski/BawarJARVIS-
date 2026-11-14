package pl.bawar.jarvis.chat.api;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import pl.bawar.jarvis.persistence.chat.ChatPersistenceService;

import java.util.NoSuchElementException;
import java.util.UUID;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class ChatRequestValidationContractTest {

    private ChatPersistenceService persistence;
    private LocalLlmClient llm;
    private ChatExchangeWriter writer;
    private MockMvc mvc;
    private UUID conversationId;

    @BeforeEach
    void setup() {
        persistence = mock(ChatPersistenceService.class);
        llm = mock(LocalLlmClient.class);
        writer = mock(ChatExchangeWriter.class);

        var service = new ChatApplicationService(
                persistence, llm, writer);

        mvc = MockMvcBuilders
                .standaloneSetup(new ChatController(service))
                .setControllerAdvice(new ChatApiExceptionHandler())
                .build();

        conversationId = UUID.randomUUID();
    }

    private void expectInvalidMessage(String json) throws Exception {
        mvc.perform(post("/api/chats/{id}/messages", conversationId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("BAD_REQUEST"));

        verifyNoInteractions(persistence, llm, writer);
    }

    @Test
    void rejectsNullMessage() throws Exception {
        expectInvalidMessage("{\"content\":null}");
    }

    @Test
    void rejectsMissingContentField() throws Exception {
        expectInvalidMessage("{}");
    }

    @Test
    void rejectsEmptyMessage() throws Exception {
        expectInvalidMessage("{\"content\":\"\"}");
    }

    @Test
    void rejectsWhitespaceOnlyMessage() throws Exception {
        expectInvalidMessage("{\"content\":\"   \\t  \"}");
    }

    @Test
    void rejectsMessageOver20000Characters() throws Exception {
        String json = "{\"content\":\"" + "a".repeat(20001) + "\"}";
        expectInvalidMessage(json);
    }

    @Test
    void acceptsBoundaryLengthAndContinuesToConversationLookup()
            throws Exception {

        when(persistence.getConversation(conversationId))
                .thenThrow(new NoSuchElementException("Missing"));

        String json = "{\"content\":\"" + "a".repeat(20000) + "\"}";

        mvc.perform(post("/api/chats/{id}/messages", conversationId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("NOT_FOUND"));

        verify(persistence).getConversation(conversationId);
        verifyNoInteractions(llm, writer);
    }
}
