package pl.bawar.jarvis.chat.api;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Fixed loopback SearXNG endpoint. Does not accept arbitrary URLs from the LLM/user.
 * Sends only current, short, non-secret user question; never chat history.
 */
@Service
public class WebSearchFallback {
    private static final URI BASE = URI.create("http://127.0.0.1:8888/search");
    private final HttpClient http;
    private final JsonMapper mapper;
    private final InternetPreferenceRepository preferences;
    private final Boolean testEnabled;

    @Autowired
    public WebSearchFallback(JsonMapper mapper, InternetPreferenceRepository preferences) {
        this(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3))
                .followRedirects(HttpClient.Redirect.NEVER).build(), mapper, preferences, null);
    }

    WebSearchFallback(HttpClient http, JsonMapper mapper, InternetPreferenceRepository preferences,
                      Boolean testEnabled) {
        this.http = http;
        this.mapper = mapper;
        this.preferences = preferences;
        this.testEnabled = testEnabled;
    }

    /** Compatibility constructor used by earlier isolated unit tests. */
    WebSearchFallback(HttpClient http, JsonMapper mapper, boolean enabled, String ignoredLegacyKey) {
        this(http, mapper, null, enabled);
    }

    boolean isReady() { return testEnabled != null ? testEnabled : preferences.enabled(); }

    Optional<String> search(String question) {
        if (!isReady() || question == null || question.isBlank() || question.length() > 450
                || WebFallbackPolicy.isSensitive(question)) return Optional.empty();
        try {
            String query = "q=" + URLEncoder.encode(question, StandardCharsets.UTF_8)
                    + "&format=json&safesearch=2&language=all";
            URI uri = URI.create(BASE.toString() + "?" + query);
            HttpRequest request = HttpRequest.newBuilder(uri)
                    .timeout(Duration.ofSeconds(6))
                    .header("Accept", "application/json")
                    .GET().build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200 || response.body() == null
                    || response.body().length() > 120_000) return Optional.empty();
            JsonNode results = mapper.readTree(response.body()).path("results");
            if (!results.isArray()) return Optional.empty();
            List<String> snippets = new ArrayList<>();
            for (int i = 0; i < Math.min(3, results.size()); i++) {
                JsonNode item = results.path(i);
                String title = item.path("title").asText("").replaceAll("[\r\n]+", " ");
                String content = item.path("content").asText("").replaceAll("[\r\n]+", " ");
                String url = item.path("url").asText("");
                if (!url.startsWith("https://") || url.length() > 500 || title.isBlank()) continue;
                snippets.add("- " + title.substring(0, Math.min(140, title.length()))
                        + ": " + content.substring(0, Math.min(350, content.length()))
                        + " (" + url + ")");
            }
            return snippets.isEmpty() ? Optional.empty() : Optional.of(String.join("\n", snippets));
        } catch (IOException | RuntimeException ignored) {
            return Optional.empty();
        } catch (InterruptedException ignored) {
            Thread.currentThread().interrupt();
            return Optional.empty();
        }
    }
}
