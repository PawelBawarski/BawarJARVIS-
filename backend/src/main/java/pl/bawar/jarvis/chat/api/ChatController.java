package pl.bawar.jarvis.chat.api;

import org.springframework.http.ResponseEntity;
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
