package pl.bawar.jarvis.chat.api;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/** Authenticated local setting. Independent from AI Lab training. */
@RestController
@RequestMapping("/api/chats/generation-settings")
@PreAuthorize("isAuthenticated()")
public class ChatGenerationPreferenceController {
    private final ChatGenerationPreferenceRepository preferences;
    public ChatGenerationPreferenceController(ChatGenerationPreferenceRepository preferences) {
        this.preferences = preferences;
    }
    @GetMapping
    public Settings get() { return new Settings(preferences.maxTokens(), 64, 1024); }
    @PutMapping
    public Settings save(@RequestBody Update update) {
        if (update == null || update.chatMaxTokens() == null)
            throw new IllegalArgumentException("chatMaxTokens is required");
        return new Settings(preferences.save(update.chatMaxTokens()), 64, 1024);
    }
    public record Settings(int chatMaxTokens, int minTokens, int maxTokens) { }
    public record Update(Integer chatMaxTokens) { }
}
