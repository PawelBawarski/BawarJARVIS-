package pl.bawar.jarvis.persistence.chat;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.UUID;

@Service
public class ChatPersistenceService {
    private final ChatConversationRepository conversations;
    private final ChatMessageRepository messages;

    public ChatPersistenceService(ChatConversationRepository conversations,
            ChatMessageRepository messages) {
        this.conversations = conversations;
        this.messages = messages;
    }

    @Transactional
    public ChatConversation createConversation(String title) {
        return conversations.create(validate(title, 200, "Title"));
    }

    @Transactional(readOnly = true)
    public List<ChatConversation> listConversations() {
        return conversations.findAll();
    }

    @Transactional(readOnly = true)
    public ChatConversation getConversation(UUID id) {
        Objects.requireNonNull(id, "Conversation ID cannot be null");
        return conversations.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Conversation not found: " + id));
    }

    @Transactional(readOnly = true)
    public List<ChatMessage> listMessages(UUID conversationId) {
        getConversation(conversationId);
        return messages.findByConversationId(conversationId);
    }

    @Transactional
    public ChatMessage appendMessage(UUID conversationId, ChatRole role, String content) {
        getConversation(conversationId);
        Objects.requireNonNull(role, "Role cannot be null");
        ChatMessage saved = messages.create(conversationId, role,
                validate(content, 20000, "Message"));
        conversations.touch(conversationId);
        return saved;
    }

    @Transactional
    public boolean deleteConversation(UUID conversationId) {
        Objects.requireNonNull(conversationId, "Conversation ID cannot be null");
        // FOREIGN KEY ON DELETE CASCADE usuwa tez wiadomosci.
        return conversations.delete(conversationId);
    }

    private static String validate(String value, int maxLength, String field) {
        if (value == null || value.isBlank() || value.length() > maxLength) {
            throw new IllegalArgumentException(
                    field + " must be non-blank and at most " + maxLength + " characters");
        }
        return value.strip();
    }

    @Transactional
    public ChatConversation renameConversation(UUID conversationId, String title) {
        Objects.requireNonNull(conversationId, "Conversation ID cannot be null");
        String validated = validate(title, 200, "Title");
        return conversations.rename(conversationId, validated)
                .orElseThrow(() -> new NoSuchElementException("Conversation not found: " + conversationId));
    }
}
