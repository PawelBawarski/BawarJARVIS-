package pl.bawar.jarvis.agent;

import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Stores only results returned by the server-side runner, never client-supplied PASS claims. */
@RestController
@RequestMapping("/api/agent/project-checks")
@PreAuthorize("hasAuthority('ROLE_JARVIS')")
public class AgentProjectCheckController {
    private final AgentProjectCheckService service;
    private final AgentProjectCheckHistoryRepository history;

    @Autowired
    public AgentProjectCheckController(@Value("${JARVIS_AGENT_TESTS_ENABLED:false}") boolean enabled,
                                       AgentProjectCheckHistoryRepository history) {
        this(new AgentProjectCheckService(enabled), history);
    }

    AgentProjectCheckController(AgentProjectCheckService service, AgentProjectCheckHistoryRepository history) {
        this.service = service;
        this.history = history;
    }

    @PostMapping("/run")
    public AgentProjectCheckService.Result run(@RequestBody AgentProjectCheckService.Request request) {
        var result = service.check(request);
        history.save(result);
        return result;
    }

    @GetMapping("/history")
    public List<AgentProjectCheckHistoryRepository.Run> history(@RequestParam(defaultValue = "20") int limit) {
        return history.recent(limit);
    }
}
