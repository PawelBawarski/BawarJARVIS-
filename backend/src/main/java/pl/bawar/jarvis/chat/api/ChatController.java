package pl.bawar.jarvis.chat.api;

import org.springframework.http.ResponseEntity;
import org.springframework.http.MediaType;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;
import org.springframework.web.bind.annotation.RequestParam;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import tools.jackson.databind.json.JsonMapper;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pl.bawar.jarvis.persistence.chat.ChatConversation;
import pl.bawar.jarvis.persistence.chat.ChatMessage;
import org.springframework.web.bind.annotation.PatchMapping;
import java.net.URI;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/** Single-user local API. All routes require Spring Security authentication. */
@RestController
@RequestMapping("/api/chats")
@PreAuthorize("isAuthenticated()")
public class ChatController {
    private final ChatApplicationService chats;
    private final JsonMapper json = new JsonMapper();
    private final ConcurrentHashMap<UUID, StreamingJob> jobs = new ConcurrentHashMap<>();
    private static final class StreamingJob {
        final AtomicBoolean stopped = new AtomicBoolean();
        final UUID conversationId;
        StreamingJob(UUID conversationId) { this.conversationId = conversationId; }
        volatile Thread worker;
        void cancel() {
            stopped.set(true);
            if (worker != null) worker.interrupt();
        }
    }

    public ChatController(ChatApplicationService chats) {
        this.chats = Objects.requireNonNull(chats);
    }

    @GetMapping("/model-status")
    public LocalLlmClient.ModelStatus modelStatus() {
        return chats.modelStatus();
    }

    @PostMapping
    public ResponseEntity<ChatConversation> create(@RequestBody CreateChatRequest request) {
        ChatConversation created = chats.createConversation(request == null ? null : request.title());
        return ResponseEntity.created(URI.create("/api/chats/" + created.id())).body(created);
    }

    @GetMapping
    public List<ChatConversation> list() {
        return chats.listConversations();
    }

    @GetMapping("/{id}")
    public ChatConversation get(@PathVariable UUID id) {
        return chats.getConversation(id);
    }

    @GetMapping("/{id}/messages")
    public List<ChatMessage> messages(@PathVariable UUID id) {
        return chats.listMessages(id);
    }

    @PostMapping("/{id}/messages")
    public ChatExchangeWriter.ChatTurn send(@PathVariable UUID id,
            @RequestBody SendMessageRequest request) {
        return chats.sendMessage(id, request == null ? null : request.content());
    }

    // JARVIS_CHAT_NATIVE_SSE_4C_V1
    @PostMapping(value = "/{id}/messages/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<StreamingResponseBody> stream(@PathVariable UUID id,
            @RequestParam UUID requestId, @RequestBody SendMessageRequest request) {
        if (request == null || request.content() == null || request.content().isBlank()
                || request.content().length() > 20_000)
            throw new IllegalArgumentException("Invalid message");
        StreamingJob job = new StreamingJob(id);
        if (jobs.putIfAbsent(requestId, job) != null)
            throw new IllegalArgumentException("Duplicate streaming request");
        StreamingResponseBody body = output -> {
            job.worker = Thread.currentThread();
            try {
                var turn = chats.sendMessageStreaming(id, request.content(), text -> {
                    try { writeEvent(output, "delta", json.writeValueAsString(text)); }
                    catch (java.io.IOException e) { job.cancel(); throw new java.io.UncheckedIOException(e); }
                }, job.stopped::get);
                if (turn == null) writeEvent(output, "cancelled", "{}");
                else writeEvent(output, "done", json.writeValueAsString(turn));
            } catch (Exception error) {
                if (!job.stopped.get()) {
                    try { writeEvent(output, "error", "{\"code\":\"STREAM_FAILED\"}"); }
                    catch (java.io.IOException ignored) { /* disconnected client */ }
                }
            } finally {
                jobs.remove(requestId, job);
                Thread.interrupted(); // clear worker interrupt for the servlet pool
            }
        };
        return ResponseEntity.ok().contentType(MediaType.TEXT_EVENT_STREAM).body(body);
    }

    @PostMapping("/{id}/messages/stream/cancel")
    public ResponseEntity<Void> cancelStream(@PathVariable UUID id, @RequestParam UUID requestId) {
        StreamingJob job = jobs.get(requestId);
        if (job != null && job.conversationId.equals(id)) job.cancel();
        return ResponseEntity.noContent().build();
    }

    private static void writeEvent(OutputStream output, String name, String data) throws java.io.IOException {
        output.write(("event: " + name + "\ndata: " + data + "\n\n").getBytes(StandardCharsets.UTF_8));
        output.flush();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        chats.deleteConversation(id);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}")
    public ChatConversation rename(@PathVariable UUID id,
            @RequestBody RenameChatRequest request) {
        return chats.renameConversation(id, request == null ? null : request.title());
    }

    public record CreateChatRequest(String title) {
    }

    public record SendMessageRequest(String content) {
    }

    public record RenameChatRequest(String title) {
    }
}
