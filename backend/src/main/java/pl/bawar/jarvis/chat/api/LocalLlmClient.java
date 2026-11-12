package pl.bawar.jarvis.chat.api;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import pl.bawar.jarvis.persistence.chat.ChatMessage;
import pl.bawar.jarvis.persistence.chat.ChatRole;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Objects;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Calls only the privately managed loopback llama.cpp server, never arbitrary
 * URLs.
 */
@Service
public class LocalLlmClient {
    static final URI CHAT_ENDPOINT = URI.create("http://127.0.0.1:8765/v1/chat/completions");
    private static final String SYSTEM = "Jesteś J.A.R.V.I.S., prywatnym asystentem użytkownika. "
            + "Odpowiadaj przede wszystkim po polsku, rzeczowo i pomocnie. "
            + "Gdy nie znasz aktualnych informacji, powiedz o ograniczeniu. "
            + "Nie twierdź, że masz internet ani że wykonałeś zadanie bez rzeczywistego narzędzia. "
            + "Nie wykonujesz samodzielnie kodu, nie zmieniasz plików bez zatwierdzenia.";

    private final HttpClient http;
    private final JsonMapper mapper;
    private final String apiKey;

    @Autowired
    public LocalLlmClient(@Value("${JARVIS_LLM_API_KEY:}") String apiKey, JsonMapper mapper) {
        this(HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .followRedirects(HttpClient.Redirect.NEVER)
                .build(), mapper, apiKey);
    }

    LocalLlmClient(HttpClient http, JsonMapper mapper, String apiKey) {
        this.http = Objects.requireNonNull(http);
        this.mapper = Objects.requireNonNull(mapper);
        this.apiKey = apiKey == null ? "" : apiKey.strip();
    }

    /** Read-only status. Verify health, model identity and bearer authentication. */
    public ModelStatus modelStatus() {
        if (apiKey.isBlank()) return new ModelStatus("jarvis-qwen3-8b", false);
        try {
            HttpRequest healthRequest = HttpRequest.newBuilder(
                    URI.create("http://127.0.0.1:8765/health"))
                    .timeout(Duration.ofSeconds(2)).GET().build();
            HttpResponse<Void> health = http.send(healthRequest, HttpResponse.BodyHandlers.discarding());
            if (health.statusCode() != 200) return new ModelStatus("jarvis-qwen3-8b", false);
            HttpRequest modelsRequest = HttpRequest.newBuilder(
                    URI.create("http://127.0.0.1:8765/v1/models"))
                    .timeout(Duration.ofSeconds(2))
                    .header("Authorization", "Bearer " + apiKey)
                    .GET().build();
            HttpResponse<String> models = http.send(modelsRequest, HttpResponse.BodyHandlers.ofString());
            boolean matched = models.statusCode() == 200 &&
                    "jarvis-qwen3-8b".equals(mapper.readTree(models.body())
                            .path("data").path(0).path("id").asText());
            return new ModelStatus("jarvis-qwen3-8b", matched);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return new ModelStatus("jarvis-qwen3-8b", false);
        } catch (JacksonException e) {
            return new ModelStatus("jarvis-qwen3-8b", false);
        } catch (IOException e) {
            return new ModelStatus("jarvis-qwen3-8b", false);
        }
    }

    public record ModelStatus(String model, boolean ready) { }

    public String reply(List<ChatMessage> history, String userMessage) {
        if (apiKey.isBlank())
            throw new LocalLlmUnavailableException("Brakuje lokalnej sesji modelu AI.");
        Objects.requireNonNull(history);
        Objects.requireNonNull(userMessage);
        ObjectNode request = mapper.createObjectNode();
        request.put("model", "jarvis-qwen3-8b");
        request.put("stream", false);
        request.put("temperature", 0.6);
        request.put("max_tokens", 512);
        ObjectNode templateArgs = request.putObject("chat_template_kwargs");
        templateArgs.put("enable_thinking", false);
        ArrayNode messages = request.putArray("messages");
        append(messages, "system", SYSTEM);
        for (ChatMessage previous : ChatPromptContext.recent(history)) {
            ChatRole role = previous.role();
            if (role == ChatRole.USER)
                append(messages, "user", previous.content());
            else if (role == ChatRole.ASSISTANT)
                append(messages, "assistant", previous.content());
        }
        append(messages, "user", userMessage);

        try {
            HttpRequest httpRequest = HttpRequest.newBuilder(CHAT_ENDPOINT)
                    .timeout(Duration.ofSeconds(150))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + apiKey)
                    .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(request)))
                    .build();
            HttpResponse<String> response = http.send(httpRequest,
                    HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200 || response.body().length() > 1_000_000) {
                throw new LocalLlmUnavailableException("Lokalny model nie odpowiedział poprawnie (HTTP "
                        + response.statusCode() + ").");
            }
            JsonNode contentNode = mapper.readTree(response.body())
                    .path("choices").path(0).path("message").path("content");
            if (!contentNode.isTextual())
                throw new LocalLlmUnavailableException("Brak treści odpowiedzi modelu.");
            String answer = contentNode.asText().replaceAll("(?s)<think>.*?</think>", "").strip();
            if (answer.isBlank())
                throw new LocalLlmUnavailableException("Model zwrócił pustą odpowiedź.");
            return answer.length() > 20_000 ? answer.substring(0, 20_000) : answer;
        } catch (JacksonException e) {
            throw new LocalLlmUnavailableException("Niepoprawna odpowiedź JSON lokalnego modelu.", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new LocalLlmUnavailableException("Przerwano oczekiwanie na lokalny model.", e);
        } catch (IOException e) {
            throw new LocalLlmUnavailableException("Lokalny model jest niedostępny lub przekroczył limit czasu.", e);
        }
    }

    private static void append(ArrayNode array, String role, String content) {
        ObjectNode item = array.addObject();
        item.put("role", role);
        item.put("content", content);
    }
}
