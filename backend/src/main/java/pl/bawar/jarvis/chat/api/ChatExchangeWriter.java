package pl.bawar.jarvis.chat.api;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.bawar.jarvis.persistence.chat.ChatMessage;
import pl.bawar.jarvis.persistence.chat.ChatPersistenceService;
import pl.bawar.jarvis.persistence.chat.ChatRole;

import java.util.Objects;
import java.util.UUID;

/** A separate Spring bean ensures @Transactional is applied through the proxy. */
@Service
public class ChatExchangeWriter {
    private final ChatPersistenceService persistence;

    public ChatExchangeWriter(ChatPersistenceService persistence) {
        this.persistence = Objects.requireNonNull(persistence);
    }

    @Transactional
    public ChatTurn appendTurn(UUID conversationId, String userText, String assistantText) {
        ChatMessage user = persistence.appendMessage(conversationId, ChatRole.USER, userText);
        ChatMessage assistant = persistence.appendMessage(conversationId, ChatRole.ASSISTANT, assistantText);
        return new ChatTurn(user, assistant);
    }

    public record ChatTurn(ChatMessage userMessage, ChatMessage assistantMessage) { }
}
