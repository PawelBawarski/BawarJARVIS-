package pl.bawar.jarvis.chat.api;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class LocalLlmClientTest {
    @Test
    @SuppressWarnings("unchecked")
    void successfulReplyUsesLoopbackBearerKeyAndModelAlias() throws Exception {
        HttpClient client = mock(HttpClient.class);
        HttpResponse<String> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(200);
        when(response.body()).thenReturn("{\"choices\":[{\"message\":{\"content\":\"Czesc z Qwen\"}}]}");
        when(client.send(any(HttpRequest.class), org.mockito.ArgumentMatchers.<HttpResponse.BodyHandler<String>>any())).thenReturn(response);
        var llm = new LocalLlmClient(client, new JsonMapper(), "test-secret");
        assertEquals("Czesc z Qwen", llm.reply(List.of(), "czesc"));
        var request = org.mockito.ArgumentCaptor.forClass(HttpRequest.class);
        verify(client).send(request.capture(), org.mockito.ArgumentMatchers.<HttpResponse.BodyHandler<String>>any());
        assertEquals("http://127.0.0.1:8765/v1/chat/completions", request.getValue().uri().toString());
        assertEquals("Bearer test-secret", request.getValue().headers().firstValue("Authorization").orElseThrow());
        assertEquals("POST", request.getValue().method());
    }

    @Test
    void noTokenDoesNotMakeNetworkRequests() {
        HttpClient client = mock(HttpClient.class);
        var llm = new LocalLlmClient(client, new JsonMapper(), "");
        assertThrows(LocalLlmUnavailableException.class, () -> llm.reply(List.of(), "Hello"));
        assertFalse(llm.modelStatus().ready());
        verifyNoInteractions(client);
    }

    @Test
    @SuppressWarnings("unchecked")
    void modelHealthReflects200Versus503() throws Exception {
        HttpClient client = mock(HttpClient.class);
        HttpResponse<String> response = mock(HttpResponse.class);
        when(client.send(any(HttpRequest.class), org.mockito.ArgumentMatchers.<HttpResponse.BodyHandler<String>>any())).thenReturn(response);
        when(response.body()).thenReturn("{\"data\":[{\"id\":\"jarvis-qwen3-8b\"}]}");
        when(response.statusCode()).thenReturn(503);
        var llm = new LocalLlmClient(client, new JsonMapper(), "token");
        assertFalse(llm.modelStatus().ready());
        when(response.statusCode()).thenReturn(200);
        assertTrue(llm.modelStatus().ready());
        when(response.body()).thenReturn("{\"data\":[{\"id\":\"different-model\"}]}");
        assertFalse(llm.modelStatus().ready());
    }

    @Test
    @SuppressWarnings("unchecked")
    void connectionFailureIsReportedAsNotReady() throws Exception {
        HttpClient client = mock(HttpClient.class);
        when(client.send(any(HttpRequest.class), org.mockito.ArgumentMatchers.<HttpResponse.BodyHandler<String>>any()))
            .thenThrow(new IOException("Connection refused"));
        var llm = new LocalLlmClient(client, new JsonMapper(), "token");
        assertFalse(llm.modelStatus().ready());
    }
}
