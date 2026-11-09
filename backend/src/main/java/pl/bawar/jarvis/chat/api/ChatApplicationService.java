package pl.bawar.jarvis.chat.api;

import org.springframework.stereotype.Service;
import pl.bawar.jarvis.brain.training.GenerationResult;
import pl.bawar.jarvis.persistence.chat.ChatConversation;
import pl.bawar.jarvis.persistence.chat.ChatMessage;
import pl.bawar.jarvis.persistence.chat.ChatPersistenceService;
import pl.bawar.jarvis.runtime.JarvisModelService;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.locks.ReentrantLock;

/** Orchestrates one model inference and one atomic database write per chat turn. */
@Service
public class ChatApplicationService {
    private static final int MAX_MESSAGE_LENGTH = 20_000;
    private static final int MAX_NEW_TOKENS = 32;
    private static final String EMPTY_MODEL_REPLY =
            "[Model nie wygenerował odpowiedzi — wymaga dalszego treningu.]";

    private final ChatPersistenceService persistence;
    private final JarvisModelService model;
    private final ChatExchangeWriter exchangeWriter;
    private final ReentrantLock turnLock = new ReentrantLock(true);

    public ChatApplicationService(ChatPersistenceService persistence,
                                  JarvisModelService model,
                                  ChatExchangeWriter exchangeWriter) {
        this.persistence = Objects.requireNonNull(persistence);
        this.model = Objects.requireNonNull(model);
        this.exchangeWriter = Objects.requireNonNull(exchangeWriter);
    }

    public ChatConversation createConversation(String title) {
        return persistence.createConversation(title);
    }

    public List<ChatConversation> listConversations() {
        return persistence.listConversations();
    }

    public ChatConversation getConversation(UUID id) {
        return persistence.getConversation(id);
    }

    public List<ChatMessage> listMessages(UUID id) {
        return persistence.listMessages(id);
    }

    public void deleteConversation(UUID id) {
        if (!persistence.deleteConversation(id)) {
            throw new NoSuchElementException("Conversation not found: " + id);
        }
    }

    public ChatExchangeWriter.ChatTurn sendMessage(UUID conversationId, String input) {
        Objects.requireNonNull(conversationId, "Conversation ID is required");
        String message = validMessage(input);
        turnLock.lock();
        try {
            // 404 before expensive inference, and do not write anything on generation failure.
            persistence.getConversation(conversationId);
            int context = model.status().contextLength();
            // Leave room for BOS and up to 32 new tokens. Persist the entire original message.
            String prompt = suffixByCodePoints(message, Math.max(1, context - 1 - MAX_NEW_TOKENS));
            GenerationResult result = model.generate(prompt, MAX_NEW_TOKENS, 0.0, 42L);
            if (!result.text().startsWith(prompt)) {
                throw new IllegalStateException("Model generation does not contain the prompt prefix");
            }
            String completion = result.text().substring(prompt.length()).strip();
            if (completion.isEmpty()) completion = EMPTY_MODEL_REPLY;
            return exchangeWriter.appendTurn(conversationId, message, completion);
        } finally {
            turnLock.unlock();
        }
    }

    private static String validMessage(String input) {
        if (input == null || input.isBlank() || input.length() > MAX_MESSAGE_LENGTH) {
            throw new IllegalArgumentException("Message must have 1-20000 characters");
        }
        return input.strip();
    }

    static String suffixByCodePoints(String input, int maxCodePoints) {
        if (maxCodePoints < 1) throw new IllegalArgumentException("Context must be positive");
        int total = input.codePointCount(0, input.length());
        return total <= maxCodePoints ? input
                : input.substring(input.offsetByCodePoints(0, total - maxCodePoints));
    }
}
