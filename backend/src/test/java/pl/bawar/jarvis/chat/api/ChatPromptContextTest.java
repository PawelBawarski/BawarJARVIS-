package pl.bawar.jarvis.chat.api;

import org.junit.jupiter.api.Test;
import pl.bawar.jarvis.persistence.chat.ChatMessage;
import pl.bawar.jarvis.persistence.chat.ChatRole;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class ChatPromptContextTest {
    private ChatMessage msg(ChatRole role, String content) {
        return new ChatMessage(UUID.randomUUID(), UUID.randomUUID(), role, content, Instant.EPOCH, 1);
    }
    @Test void includesOnlyEightRecentMessagesInOriginalOrder() {
        List<ChatMessage> messages = new ArrayList<>();
        for (int i=0;i<20;i++) messages.add(msg(ChatRole.USER, "msg"+i));
        List<ChatMessage> recent = ChatPromptContext.recent(messages);
        assertEquals(8, recent.size());
        assertEquals("msg12", recent.getFirst().content());
        assertEquals("msg19", recent.getLast().content());
    }
    @Test void skipsSystemMessagesAndHugeHistory() {
        List<ChatMessage> recent = ChatPromptContext.recent(List.of(
                msg(ChatRole.USER, "hello"), msg(ChatRole.SYSTEM, "secret"), msg(ChatRole.ASSISTANT, "ok")));
        assertEquals(2, recent.size());
        assertEquals("hello", recent.getFirst().content());
    }
}
