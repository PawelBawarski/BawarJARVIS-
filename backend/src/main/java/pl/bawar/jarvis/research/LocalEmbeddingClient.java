package pl.bawar.jarvis.research;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Objects;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

/** Optional dedicated, localhost-only embedding server. Not the conversational Qwen3-8B. */
@Service
public class LocalEmbeddingClient {
    private static final URI ENDPOINT = URI.create("http://127.0.0.1:8766/v1/embeddings");
    private final HttpClient http;
    private final JsonMapper mapper;
    private final boolean enabled;
    private final String model;

    @Autowired
    public LocalEmbeddingClient(@Value("${JARVIS_EMBEDDINGS_ENABLED:false}") boolean enabled,
                                @Value("${JARVIS_EMBEDDINGS_MODEL:jarvis-qwen3-embedding-0.6b}") String model,
                                JsonMapper mapper) {
        this(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2))
            .followRedirects(HttpClient.Redirect.NEVER).build(), mapper, enabled, model);
    }

    LocalEmbeddingClient(HttpClient http, JsonMapper mapper, boolean enabled, String model) {
        this.http = Objects.requireNonNull(http);
        this.mapper = Objects.requireNonNull(mapper);
        this.enabled = enabled;
        if (model == null || !model.matches("[a-zA-Z0-9._-]{1,100}"))
            throw new IllegalArgumentException("SEMANTIC_MODEL_INVALID");
        this.model = model;
    }

    public boolean enabled() { return enabled; }
    public String model() { return model; }

    public float[] embedDocument(String title, String excerpt) {
        String source = (title == null ? "" : title.strip()) + "\n" + (excerpt == null ? "" : excerpt.strip());
        if (source.length() > 1600) source = source.substring(0, 1600);
        return embed(source);
    }

    public float[] embedQuery(String question) {
        if (question == null || question.isBlank() || question.length() > 500)
            throw new IllegalArgumentException("SEMANTIC_QUERY_INVALID");
        // Qwen3-Embedding is instruction-aware; document embeddings are NOT prepended this way.
        return embed("Instruct: Retrieve passages relevant to the user's question.\nQuery: " + question.strip());
    }

    private float[] embed(String text) {
        if (!enabled) throw new IllegalStateException("SEMANTIC_DISABLED");
        try {
            ObjectNode request = mapper.createObjectNode();
            request.put("model", model);
            request.put("input", text);
            HttpRequest httpRequest = HttpRequest.newBuilder(ENDPOINT)
                .timeout(Duration.ofSeconds(8))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(request)))
                .build();
            HttpResponse<String> response = http.send(httpRequest, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200 || response.body().length() > 100_000)
                throw new SemanticUnavailableException();
            JsonNode values = mapper.readTree(response.body()).path("data").path(0).path("embedding");
            if (!values.isArray() || values.size() < SemanticVector.MIN_DIMS || values.size() > SemanticVector.MAX_DIMS)
                throw new SemanticUnavailableException();
            float[] vector = new float[values.size()];
            for (int i = 0; i < vector.length; i++) {
                JsonNode number = values.path(i);
                if (!number.isNumber()) throw new SemanticUnavailableException();
                double value = number.doubleValue();
                if (!Double.isFinite(value) || Math.abs(value) > Float.MAX_VALUE)
                    throw new SemanticUnavailableException();
                vector[i] = (float) value;
            }
            return SemanticVector.normalize(vector);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new SemanticUnavailableException();
        } catch (IOException | JacksonException e) {
            throw new SemanticUnavailableException();
        } catch (IllegalArgumentException e) {
            throw new SemanticUnavailableException();
        }
    }

    public static final class SemanticUnavailableException extends RuntimeException {
        public SemanticUnavailableException() { super("SEMANTIC_MODEL_UNAVAILABLE"); }
    }
}
