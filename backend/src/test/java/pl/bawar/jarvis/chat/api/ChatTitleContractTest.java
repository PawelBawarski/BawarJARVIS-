package pl.bawar.jarvis.chat.api;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import pl.bawar.jarvis.persistence.chat.ChatConversation;

import java.time.Instant;
import java.util.UUID;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class ChatTitleContractTest {

    private ChatApplicationService service;
    private MockMvc mvc;
    private UUID id;

    private ChatConversation conversation(String title) {
        return new ChatConversation(
                id, title, Instant.EPOCH, Instant.EPOCH);
    }

    @BeforeEach
    void setup() {
        service = mock(ChatApplicationService.class);
        id = UUID.randomUUID();

        mvc = MockMvcBuilders
                .standaloneSetup(new ChatController(service))
                .setControllerAdvice(new ChatApiExceptionHandler())
                .build();
    }

    @Test
    void createReturns201AndLocation() throws Exception {
        when(service.createConversation("Nowy czat"))
                .thenReturn(conversation("Nowy czat"));

        mvc.perform(post("/api/chats")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Nowy czat\"}"))
            .andExpect(status().isCreated())
            .andExpect(header().string(
                    "Location", "/api/chats/" + id))
            .andExpect(jsonPath("$.title").value("Nowy czat"));

        verify(service).createConversation("Nowy czat");
    }

    @Test
    void renameDelegatesTitleAndReturnsConversation() throws Exception {
        when(service.renameConversation(id, "Zmieniona nazwa"))
                .thenReturn(conversation("Zmieniona nazwa"));

        mvc.perform(patch("/api/chats/{id}", id)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Zmieniona nazwa\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.title")
                    .value("Zmieniona nazwa"));

        verify(service).renameConversation(
                id, "Zmieniona nazwa");
    }

    @Test
    void missingTitleIsDelegatedAsNull() throws Exception {
        when(service.createConversation(null))
                .thenReturn(conversation("Nowy czat"));

        mvc.perform(post("/api/chats")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
            .andExpect(status().isCreated());

        verify(service).createConversation(null);
    }

    @Test
    void blankTitleIsDelegatedToService() throws Exception {
        when(service.renameConversation(id, ""))
                .thenReturn(conversation("Domyslna nazwa"));

        mvc.perform(patch("/api/chats/{id}", id)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"\"}"))
            .andExpect(status().isOk());

        verify(service).renameConversation(id, "");
    }

    @Test
    void malformedJsonReturns400WithoutCallingService()
            throws Exception {

        mvc.perform(post("/api/chats")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":"))
            .andExpect(status().isBadRequest());

        verifyNoInteractions(service);
    }
}
