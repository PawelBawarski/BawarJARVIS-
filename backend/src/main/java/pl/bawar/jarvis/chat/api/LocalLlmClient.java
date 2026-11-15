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
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;
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
    // Optional field injection preserves existing test constructors and loopback restrictions.
    @Autowired(required = false)
    private ChatGenerationPreferenceRepository chatPreferences;

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
                            .path("data").path(0).path("id").asString(""));
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

    private static final int MAX_RESPONSE_PARTS = 12;
    // Bound a single chat request, including any continuation calls.
    // At ~4-5 tokens/sec, 1024 tokens often needs more than 150 seconds.
    private static final int MAX_TOTAL_REPLY_SECONDS = 360;
    private static final long MIN_CONTINUE_MILLIS = 5_000L;
    private static final int MAX_RESPONSE_CHARS = 20_000;
    private static final String INCOMPLETE_NOTICE = "\n\n[Odpowiedź nie została w pełni zakończona. "
            + "Poproś o kontynuację albo zwiększ limit tokenów w Settings → Czat AI.]";

    /**
     * The preference is a PER-REQUEST budget. A finish_reason=length means
     * that llama.cpp stopped because of this budget, NOT because the answer
     * was completed. Accumulate bounded continuations before persisting.
     */
    public String reply(List<ChatMessage> history, String userMessage) {
        if (apiKey.isBlank())
            throw new LocalLlmUnavailableException("Brakuje lokalnej sesji modelu AI.");
        Objects.requireNonNull(history);
        Objects.requireNonNull(userMessage);
        int perPartTokens = chatPreferences == null
                ? maxTokens(System.getenv("JARVIS_LLM_MAX_TOKENS"))
                : chatPreferences.maxTokens();
        ArrayNode messages = mapper.createArrayNode();
        append(messages, "system", SYSTEM);
        for (ChatMessage previous : ChatPromptContext.recent(history)) {
            if (previous.role() == ChatRole.USER) append(messages, "user", previous.content());
            else if (previous.role() == ChatRole.ASSISTANT) append(messages, "assistant", previous.content());
        }
        append(messages, "user", userMessage);

        StringBuilder answer = new StringBuilder();
        long deadlineNanos = System.nanoTime()
                + Duration.ofSeconds(MAX_TOTAL_REPLY_SECONDS).toNanos();
        for (int part = 0; part < MAX_RESPONSE_PARTS; part++) {
            long remainingNanos = deadlineNanos - System.nanoTime();
            if (remainingNanos < Duration.ofMillis(MIN_CONTINUE_MILLIS).toNanos()) {
                if (!answer.isEmpty()) return answer.toString().strip() + INCOMPLETE_NOTICE;
                throw new LocalLlmUnavailableException("Przekroczono czas generowania odpowiedzi.");
            }
            Completion completion;
            try {
                completion = complete(messages, perPartTokens, Duration.ofNanos(remainingNanos));
            } catch (LocalLlmUnavailableException error) {
                if (answer.isEmpty()) throw error;
                return answer.toString().strip() + INCOMPLETE_NOTICE;
            }
            String chunk = completion.text().replaceAll("(?s)<think>.*?</think>", "");
            if (chunk.isBlank()) {
                if (answer.isEmpty())
                    throw new LocalLlmUnavailableException("Model zwrócił pustą odpowiedź.");
                return answer.toString().strip() + INCOMPLETE_NOTICE;
            }
            if (answer.length() + chunk.length() > MAX_RESPONSE_CHARS) {
                int remaining = MAX_RESPONSE_CHARS - answer.length();
                if (remaining > 0) answer.append(chunk, 0, remaining);
                return answer.toString().strip() + INCOMPLETE_NOTICE;
            }
            answer.append(chunk);
            if (!"length".equals(completion.finishReason()))
                return answer.toString().strip();

            // Keep the generated assistant text as context. Do not create a new
            // stored chat turn for each partial response.
            append(messages, "assistant", chunk);
            append(messages, "user", "Kontynuuj dokładnie od miejsca, w którym odpowiedź "
                    + "się urwała. Nie powtarzaj wcześniejszego tekstu, "
                    + "nie rozpoczynaj odpowiedzi od nowa. Dokończ kod, jeśli jest urwany.");
        }
        return answer.toString().strip() + INCOMPLETE_NOTICE;
    }

    // JARVIS_CHAT_NATIVE_SSE_4C_V1
    /** Tokens are forwarded immediately from llama.cpp; never buffer a whole HTTP response. */
    public String replyStreaming(List<ChatMessage> history, String question,
            Consumer<String> onToken, BooleanSupplier cancelled) {
        if (apiKey.isBlank()) throw new LocalLlmUnavailableException("Missing local LLM session");
        Objects.requireNonNull(onToken);
        Objects.requireNonNull(cancelled);
        int tokens = chatPreferences == null ? maxTokens(System.getenv("JARVIS_LLM_MAX_TOKENS"))
                : chatPreferences.maxTokens();
        ArrayNode messages = mapper.createArrayNode();
        append(messages, "system", SYSTEM);
        for (ChatMessage previous : ChatPromptContext.recent(history)) {
            append(messages, previous.role() == ChatRole.USER ? "user" : "assistant", previous.content());
        }
        append(messages, "user", question);
        long deadline = System.nanoTime() + Duration.ofSeconds(MAX_TOTAL_REPLY_SECONDS).toNanos();
        StringBuilder answer = new StringBuilder();
        boolean complete = false;
        for (int part = 0; part < MAX_RESPONSE_PARTS; part++) {
            if (cancelled.getAsBoolean() || Thread.currentThread().isInterrupted()) break;
            long remaining = deadline - System.nanoTime();
            if (remaining < Duration.ofSeconds(5).toNanos()) break;
            StreamPart result;
            try {
                result = streamPart(messages, tokens, Duration.ofNanos(remaining), text -> {
                    int space = MAX_RESPONSE_CHARS - answer.length();
                    if (space <= 0 || cancelled.getAsBoolean()) return;
                    String safe = text.length() <= space ? text : text.substring(0, space);
                    answer.append(safe);
                    onToken.accept(safe);
                }, cancelled);
            } catch (RuntimeException ex) {
                if (answer.isEmpty()) throw ex;
                break;
            }
            if (cancelled.getAsBoolean() || answer.length() >= MAX_RESPONSE_CHARS) break;
            if (!"length".equals(result.finishReason())) {
                complete = "stop".equals(result.finishReason()) || "eos".equals(result.finishReason());
                break;
            }
            if (result.text().isBlank()) break;
            append(messages, "assistant", result.text());
            append(messages, "user", "Kontynuuj dokładnie od ostatniego znaku bez powtarzania tekstu. "
                    + "Jeżeli kod jest urwany, dokończ go.");
        }
        if (answer.isEmpty()) {
            if (cancelled.getAsBoolean()) return "";
            throw new LocalLlmUnavailableException("Lokalny model nie wygenerował odpowiedzi.");
        }
        if (!complete) {
            String notice = "\n\n[Odpowiedź przerwana lub nieukończona. Poproś o kontynuację.]";
            answer.append(notice);
            if (!cancelled.getAsBoolean()) onToken.accept(notice);
        }
        return answer.toString().strip();
    }

    private record StreamPart(String text, String finishReason) { }

    private StreamPart streamPart(ArrayNode messages, int maxTokens, Duration timeout,
            Consumer<String> onToken, BooleanSupplier cancelled) {
        ObjectNode body = mapper.createObjectNode();
        body.put("model", "jarvis-qwen3-8b");
        body.put("stream", true);
        body.put("temperature", 0.6);
        body.put("max_tokens", maxTokens);
        body.putObject("chat_template_kwargs").put("enable_thinking", false);
        body.set("messages", messages);
        StringBuilder accumulated = new StringBuilder();
        String finish = "";
        boolean thinking = false;
        StringBuilder pending = new StringBuilder();
        try {
            HttpRequest request = HttpRequest.newBuilder(CHAT_ENDPOINT)
                    .timeout(timeout)
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + apiKey)
                    .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)))
                    .build();
            HttpResponse<InputStream> response = http.send(request, HttpResponse.BodyHandlers.ofInputStream());
            if (response.statusCode() != 200) {
                response.body().close();
                throw new LocalLlmUnavailableException("Llama HTTP " + response.statusCode());
            }
            try (InputStream stream = response.body();
                 BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
                String line;
                while (!cancelled.getAsBoolean() && !Thread.currentThread().isInterrupted()
                        && (line = reader.readLine()) != null) {
                    if (!line.startsWith("data: ")) continue;
                    String data = line.substring(6).trim();
                    if (data.equals("[DONE]")) break;
                    if (data.length() > 200_000) throw new IOException("Oversized llama SSE frame");
                    JsonNode choice = mapper.readTree(data).path("choices").path(0);
                    String reason = choice.path("finish_reason").asString("");
                    if (!reason.isBlank() && !"null".equals(reason)) finish = reason;
                    JsonNode delta = choice.path("delta").path("content");
                    if (!delta.isString()) continue;
                    // Qwen3 thinking disabled. Still strip residual <think> blocks across frame boundaries.
                    pending.append(delta.asString());
                    while (!pending.isEmpty()) {
                        if (thinking) {
                            int end = pending.indexOf("</think>");
                            if (end < 0) {
                                if (pending.length() > 16) pending.delete(0, pending.length() - 16);
                                break;
                            }
                            pending.delete(0, end + 8);
                            thinking = false;
                            continue;
                        }
                        int start = pending.indexOf("<think>");
                        if (start >= 0) {
                            if (start > 0) {
                                String chunk = pending.substring(0, start);
                                accumulated.append(chunk);
                                onToken.accept(chunk);
                            }
                            pending.delete(0, start + 7);
                            thinking = true;
                            continue;
                        }
                        // Hold a few trailing characters in case a tag is split across frames.
                        int keep = 6;
                        if (pending.length() <= keep) break;
                        String chunk = pending.substring(0, pending.length() - keep);
                        accumulated.append(chunk);
                        onToken.accept(chunk);
                        pending.delete(0, pending.length() - keep);
                    }
                }
                if (!thinking && !pending.isEmpty() && !cancelled.getAsBoolean()) {
                    accumulated.append(pending);
                    onToken.accept(pending.toString());
                }
            }
            return new StreamPart(accumulated.toString(), finish);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            if (cancelled.getAsBoolean()) return new StreamPart(accumulated.toString(), "cancelled");
            throw new LocalLlmUnavailableException("Przerwano generowanie.", e);
        } catch (IOException e) {
            if (cancelled.getAsBoolean()) return new StreamPart(accumulated.toString(), "cancelled");
            throw new LocalLlmUnavailableException("Błąd strumienia lokalnego modelu.", e);
        }
    }

    private record Completion(String text, String finishReason) { }

    private Completion complete(ArrayNode messages, int perPartTokens, Duration remaining) {
        ObjectNode request = mapper.createObjectNode();
        request.put("model", "jarvis-qwen3-8b");
        request.put("stream", false);
        request.put("temperature", 0.6);
        request.put("max_tokens", perPartTokens);
        request.putObject("chat_template_kwargs").put("enable_thinking", false);
        request.set("messages", messages);
        try {
            HttpRequest httpRequest = HttpRequest.newBuilder(CHAT_ENDPOINT)
                    .timeout(remaining)
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + apiKey)
                    .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(request)))
                    .build();
            HttpResponse<String> response = http.send(httpRequest, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200 || response.body() == null
                    || response.body().length() > 1_000_000) {
                throw new LocalLlmUnavailableException("Lokalny model nie odpowiedział poprawnie (HTTP "
                        + response.statusCode() + ").");
            }
            JsonNode choice = mapper.readTree(response.body()).path("choices").path(0);
            JsonNode content = choice.path("message").path("content");
            if (!content.isString())
                throw new LocalLlmUnavailableException("Brak treści odpowiedzi modelu.");
            return new Completion(content.asString(), choice.path("finish_reason").asString(""));
        } catch (JacksonException e) {
            throw new LocalLlmUnavailableException("Niepoprawna odpowiedź JSON lokalnego modelu.", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new LocalLlmUnavailableException("Przerwano oczekiwanie na lokalny model.", e);
        } catch (IOException e) {
            throw new LocalLlmUnavailableException("Lokalny model jest niedostępny lub przekroczył limit czasu.", e);
        }
    }

    static int maxTokens(String raw) {
        if (raw == null || raw.isBlank()) return 256;
        try {
            int number = Integer.parseInt(raw.trim());
            return number >= 64 && number <= 1024 ? number : 256;
        } catch (NumberFormatException ignored) {
            return 256;
        }
    }

    private static void append(ArrayNode array, String role, String content) {
        ObjectNode item = array.addObject();
        item.put("role", role);
        item.put("content", content);
    }
}
