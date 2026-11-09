package pl.bawar.jarvis.persistence.chat;

import java.time.Instant;
import java.util.UUID;

public record ChatConversation(
        UUID id,
        String title,
        Instant createdAt,
        Instant updatedAt
) {}
