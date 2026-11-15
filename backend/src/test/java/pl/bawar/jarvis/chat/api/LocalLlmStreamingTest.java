package pl.bawar.jarvis.chat.api;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;
import java.io.ByteArrayInputStream;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class LocalLlmStreamingTest {
    @Test @SuppressWarnings("unchecked")
    void emitsTokensIncrementallyAndCompletes() throws Exception {
        HttpClient client = mock(HttpClient.class);
        HttpResponse<java.io.InputStream> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(200);
        String events = "data: {\"choices\":[{\"delta\":{\"content\":\"Czesc \"}}]}\n\n"
                + "data: {\"choices\":[{\"delta\":{\"content\":\"swiecie!\"}}]}\n\n"
                + "data: {\"choices\":[{\"delta\":{},\"finish_reason\":\"stop\"}]}\n\n"
                + "data: [DONE]\n\n";
        when(response.body()).thenReturn(new ByteArrayInputStream(events.getBytes(StandardCharsets.UTF_8)));
        when(client.send(any(HttpRequest.class), org.mockito.ArgumentMatchers.<HttpResponse.BodyHandler<java.io.InputStream>>any()))
                .thenReturn(response);
        StringBuilder streamed = new StringBuilder();
        var llm = new LocalLlmClient(client, new JsonMapper(), "token");
        String reply = llm.replyStreaming(List.of(), "Test", streamed::append, () -> false);
        assertEquals("Czesc swiecie!", reply);
        assertEquals(reply, streamed.toString());
    }
}
