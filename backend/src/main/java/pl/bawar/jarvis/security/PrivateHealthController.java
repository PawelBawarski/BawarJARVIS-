package pl.bawar.jarvis.security;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/security")
public class PrivateHealthController {

    @GetMapping("/private-health")
    public Map<String, String> privateHealth() {
        return Map.of("status", "AUTHENTICATED");
    }
}
