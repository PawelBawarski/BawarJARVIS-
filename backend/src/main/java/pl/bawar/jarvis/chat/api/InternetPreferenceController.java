package pl.bawar.jarvis.chat.api;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Same authenticated local session as /api/chats; never publicly accessible. */
@RestController
@RequestMapping("/api/chats/web-settings")
@PreAuthorize("isAuthenticated()")
public class InternetPreferenceController {
    private final InternetPreferenceRepository repo;
    public InternetPreferenceController(InternetPreferenceRepository repo) { this.repo = repo; }

    @GetMapping
    public Setting get() { return new Setting(repo.enabled()); }

    @PutMapping
    public Setting put(@RequestBody Setting setting) {
        if (setting == null || setting.internetEnabled() == null)
            throw new IllegalArgumentException("internetEnabled is required");
        return new Setting(repo.save(setting.internetEnabled()));
    }

    public record Setting(Boolean internetEnabled) { }
}
