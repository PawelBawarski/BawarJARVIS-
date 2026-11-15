package pl.bawar.jarvis.chat.api;

import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class WebSearchFallbackTest {
    @Test void disabledSearchNeverInvokesExternalService() {
        HttpClient client = mock(HttpClient.class);
        var search = new WebSearchFallback(client, new JsonMapper(), false, "");
        assertTrue(search.search("Co to Angular?").isEmpty());
        verifyNoInteractions(client);
    }

    @Test @SuppressWarnings("unchecked") void usesOnlyLoopbackSearxngAndJsonFormat() throws Exception {
        HttpClient client = mock(HttpClient.class);
        HttpResponse<String> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(200);
        when(response.body()).thenReturn("{\"results\":[{\"title\":\"Angular\","
                + "\"content\":\"Framework\",\"url\":\"https://angular.dev\"}]}");
        when(client.send(any(HttpRequest.class),
                org.mockito.ArgumentMatchers.<HttpResponse.BodyHandler<String>>any())).thenReturn(response);
        var search = new WebSearchFallback(client, new JsonMapper(), true, "");
        assertTrue(search.search("Angular & Java?").orElseThrow().contains("https://angular.dev"));
        var capture = org.mockito.ArgumentCaptor.forClass(HttpRequest.class);
        verify(client).send(capture.capture(),
                org.mockito.ArgumentMatchers.<HttpResponse.BodyHandler<String>>any());
        HttpRequest request = capture.getValue();
        assertEquals("127.0.0.1", request.uri().getHost());
        assertEquals(8888, request.uri().getPort());
        assertTrue(request.uri().getRawQuery().contains("format=json"));
        assertTrue(request.uri().getRawQuery().contains("Angular+%26+Java%3F"));
        assertFalse(request.headers().firstValue("X-Subscription-Token").isPresent());
    }
}
