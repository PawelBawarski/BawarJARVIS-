package pl.bawar.jarvis.persistence.chat;

import java.time.Instant;
import java.util.UUID;

public record ChatMessage(
        UUID id,
        UUID conversationId,
        ChatRole role,
        String content,
        Instant createdAt,
        long order
) {}
