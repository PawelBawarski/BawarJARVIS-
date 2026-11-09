package pl.bawar.jarvis.chat.api;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.security.access.prepost.PreAuthorize;
import pl.bawar.jarvis.persistence.chat.ChatConversation;

import java.time.Instant;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Standalone MVC contract tests. Security is verified separately by @PreAuthorize. */
class ChatControllerTest {
    private ChatApplicationService service;
    private MockMvc mvc;

    @BeforeEach
    void setup() {
        service = mock(ChatApplicationService.class);
        mvc = MockMvcBuilders.standaloneSetup(new ChatController(service))
                .setControllerAdvice(new ChatApiExceptionHandler()).build();
    }

    @Test
    void createsConversationAndReturnsLocation() throws Exception {
        UUID id = UUID.randomUUID();
        when(service.createConversation("Pierwszy czat")).thenReturn(
                new ChatConversation(id, "Pierwszy czat", Instant.EPOCH, Instant.EPOCH));
        mvc.perform(post("/api/chats").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Pierwszy czat\"}"))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", "/api/chats/" + id));
    }

    @Test
    void listsConversations() throws Exception {
        when(service.listConversations()).thenReturn(List.of());
        mvc.perform(get("/api/chats"))
                .andExpect(status().isOk())
                .andExpect(content().json("[]"));
    }

    @Test
    void mapsMissingConversationTo404() throws Exception {
        UUID id = UUID.randomUUID();
        when(service.getConversation(id)).thenThrow(new NoSuchElementException("Missing"));
        mvc.perform(get("/api/chats/" + id))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void mapsInvalidMessageTo400() throws Exception {
        UUID id = UUID.randomUUID();
        when(service.sendMessage(id, "bad"))
                .thenThrow(new IllegalArgumentException("Invalid"));
        mvc.perform(post("/api/chats/" + id + "/messages")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"bad\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"));
    }

    @Test
    void deletesConversation() throws Exception {
        UUID id = UUID.randomUUID();
        mvc.perform(delete("/api/chats/" + id))
                .andExpect(status().isNoContent());
        verify(service).deleteConversation(id);
    }

    @Test
    void controllerDeclaresAuthenticationRequirement() {
        PreAuthorize annotation = ChatController.class.getAnnotation(PreAuthorize.class);
        assertNotNull(annotation);
        assertEquals("isAuthenticated()", annotation.value());
    }
}
