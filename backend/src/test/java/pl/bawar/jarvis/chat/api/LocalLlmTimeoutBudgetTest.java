package pl.bawar.jarvis.chat.api;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class LocalLlmTimeoutBudgetTest {
    @Test
    @SuppressWarnings("unchecked")
    void longTokenBudgetIsNotCutOffAtOld150Seconds() throws Exception {
        HttpClient http = mock(HttpClient.class);
        HttpResponse<String> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(200);
        when(response.body()).thenReturn("{\"choices\":[{\"message\":{\"content\":\"OK\"},\"finish_reason\":\"stop\"}]}");
        AtomicReference<HttpRequest> request = new AtomicReference<>();
        when(http.send(any(HttpRequest.class), org.mockito.ArgumentMatchers.<HttpResponse.BodyHandler<String>>any()))
                .thenAnswer(invocation -> { request.set(invocation.getArgument(0)); return response; });
        assertEquals("OK", new LocalLlmClient(http, new JsonMapper(), "token")
                .reply(List.of(), "Test"));
        assertTrue(request.get().timeout().orElseThrow().compareTo(Duration.ofSeconds(150)) > 0);
    }

    @Test
    @SuppressWarnings("unchecked")
    void timeoutAfterFirstPartReturnsClearlyMarkedPartialAnswer() throws Exception {
        HttpClient http = mock(HttpClient.class);
        HttpResponse<String> first = mock(HttpResponse.class);
        when(first.statusCode()).thenReturn(200);
        when(first.body()).thenReturn("{\"choices\":[{\"message\":{\"content\":\"Zaczęta odpowiedź. \"},\"finish_reason\":\"length\"}]}");
        when(http.send(any(HttpRequest.class), org.mockito.ArgumentMatchers.<HttpResponse.BodyHandler<String>>any()))
                .thenReturn(first).thenThrow(new HttpTimeoutException("simulated timeout"));
        String output = new LocalLlmClient(http, new JsonMapper(), "token")
                .reply(List.of(), "Długi temat");
        assertTrue(output.startsWith("Zaczęta odpowiedź."));
        assertTrue(output.contains("nie została w pełni zakończona"));
        verify(http, times(2)).send(any(HttpRequest.class), org.mockito.ArgumentMatchers.<HttpResponse.BodyHandler<String>>any());
    }
}
