package pl.bawar.jarvis.chat.api;

import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;
import pl.bawar.jarvis.research.KnowledgeMemoryService;
import pl.bawar.jarvis.persistence.chat.ChatConversation;
import pl.bawar.jarvis.persistence.chat.ChatMessage;
import pl.bawar.jarvis.persistence.chat.ChatPersistenceService;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Uses the locally managed Qwen GGUF model. TinyGpt remains an AI Lab
 * experiment.
 */
@Service
public class ChatApplicationService {
    private static final int MAX_MESSAGE_LENGTH = 20_000;
    private final ChatPersistenceService persistence;
    private final LocalLlmClient llm;
    private KnowledgeMemoryService knowledge; // JARVIS_15_RESEARCH_MEMORY
    private final ChatExchangeWriter exchangeWriter;
    private final ReentrantLock turnLock = new ReentrantLock(true);

    public ChatApplicationService(ChatPersistenceService persistence,
            LocalLlmClient llm,
            ChatExchangeWriter exchangeWriter) {
        this.persistence = Objects.requireNonNull(persistence);
        this.llm = Objects.requireNonNull(llm);
        this.exchangeWriter = Objects.requireNonNull(exchangeWriter);
    }

    @Autowired(required = false)
    void setKnowledgeMemoryService(KnowledgeMemoryService knowledge) {
        this.knowledge = knowledge;
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
        if (!persistence.deleteConversation(id))
            throw new NoSuchElementException("Conversation not found: " + id);
    }

    public ChatExchangeWriter.ChatTurn sendMessage(UUID conversationId, String input) {
        Objects.requireNonNull(conversationId, "Conversation ID is required");
        if (input == null || input.isBlank() || input.length() > MAX_MESSAGE_LENGTH) {
            throw new IllegalArgumentException("Message must have 1-20000 characters");
        }
        String message = input.strip();
        turnLock.lock();
        try {
            // Validate conversation before inference. Never persist partial/failed LLM
            // turns.
            persistence.getConversation(conversationId);
            List<ChatMessage> history = persistence.listMessages(conversationId);
            String answer = llm.reply(history, knowledge == null ? message : knowledge.augmentPrompt(message));
            if (answer == null || answer.isBlank())
                throw new LocalLlmUnavailableException("Pusta odpowiedź AI.");
            return exchangeWriter.appendTurn(conversationId, message, answer);
        } finally {
            turnLock.unlock();
        }
    }

    public ChatConversation renameConversation(UUID id, String title) {
        return persistence.renameConversation(id, title);
    }
}
