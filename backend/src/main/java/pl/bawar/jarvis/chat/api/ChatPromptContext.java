package pl.bawar.jarvis.chat.api;

import pl.bawar.jarvis.persistence.chat.ChatMessage;
import pl.bawar.jarvis.persistence.chat.ChatRole;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** A deliberately small bounded history for 4k context windows on 10GB VRAM. */
public final class ChatPromptContext {
    private ChatPromptContext() { }

    public static List<ChatMessage> recent(List<ChatMessage> messages) {
        if (messages == null || messages.isEmpty()) return List.of();
        List<ChatMessage> found = new ArrayList<>();
        int chars = 0;
        for (int index = messages.size() - 1; index >= 0 && found.size() < 8; index--) {
            ChatMessage msg = messages.get(index);
            if (msg == null || msg.content() == null || msg.content().isBlank()) continue;
            if (msg.role() != ChatRole.USER && msg.role() != ChatRole.ASSISTANT) continue;
            if (msg.content().length() > 1200 || chars + msg.content().length() > 5000) break;
            found.add(msg);
            chars += msg.content().length();
        }
        Collections.reverse(found);
        return List.copyOf(found);
    }
}
