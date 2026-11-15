package pl.bawar.jarvis.chat.api;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class LocalLlmContinuationTest {
    @Test
    @SuppressWarnings("unchecked")
    void lengthFinishTriggersContinuationAndJoinsFragments() throws Exception {
        HttpClient client = mock(HttpClient.class);
        HttpResponse<String> first = mock(HttpResponse.class);
        HttpResponse<String> second = mock(HttpResponse.class);
        when(first.statusCode()).thenReturn(200);
        when(second.statusCode()).thenReturn(200);
        when(first.body()).thenReturn("{\"choices\":[{\"message\":{\"content\":\"Pierwsza \"},\"finish_reason\":\"length\"}]}");
        when(second.body()).thenReturn("{\"choices\":[{\"message\":{\"content\":\"druga część.\"},\"finish_reason\":\"stop\"}]}");
        when(client.send(any(HttpRequest.class), org.mockito.ArgumentMatchers.<HttpResponse.BodyHandler<String>>any()))
                .thenReturn(first, second);
        LocalLlmClient llm = new LocalLlmClient(client, new JsonMapper(), "token");
        assertEquals("Pierwsza druga część.", llm.reply(List.of(), "Napisz odpowiedź"));
        verify(client, times(2)).send(any(HttpRequest.class), org.mockito.ArgumentMatchers.<HttpResponse.BodyHandler<String>>any());
    }

    @Test
    @SuppressWarnings("unchecked")
    void finishStopDoesNotCallModelTwice() throws Exception {
        HttpClient client = mock(HttpClient.class);
        HttpResponse<String> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(200);
        when(response.body()).thenReturn("{\"choices\":[{\"message\":{\"content\":\"Gotowe\"},\"finish_reason\":\"stop\"}]}");
        when(client.send(any(HttpRequest.class), org.mockito.ArgumentMatchers.<HttpResponse.BodyHandler<String>>any()))
                .thenReturn(response);
        assertEquals("Gotowe", new LocalLlmClient(client, new JsonMapper(), "token").reply(List.of(), "Cześć"));
        verify(client).send(any(HttpRequest.class), org.mockito.ArgumentMatchers.<HttpResponse.BodyHandler<String>>any());
    }

    @Test
    @SuppressWarnings("unchecked")
    void boundedContinuationNeverPretendsIncompleteAnswerIsComplete() throws Exception {
        HttpClient client = mock(HttpClient.class);
        HttpResponse<String> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(200);
        when(response.body()).thenReturn("{\"choices\":[{\"message\":{\"content\":\"fragment\"},\"finish_reason\":\"length\"}]}");
        when(client.send(any(HttpRequest.class), org.mockito.ArgumentMatchers.<HttpResponse.BodyHandler<String>>any()))
                .thenReturn(response);
        String result = new LocalLlmClient(client, new JsonMapper(), "token").reply(List.of(), "Pisz");
        assertTrue(result.contains("nie została w pełni zakończona"));
        verify(client, times(12)).send(any(HttpRequest.class), org.mockito.ArgumentMatchers.<HttpResponse.BodyHandler<String>>any());
    }
}
