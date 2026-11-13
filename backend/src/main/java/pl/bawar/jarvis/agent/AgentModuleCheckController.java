package pl.bawar.jarvis.agent;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Explicit opt-in check of related, user-selected source files only. */
@RestController
@RequestMapping("/api/agent/module-checks")
@PreAuthorize("hasAuthority('ROLE_JARVIS')")
public class AgentModuleCheckController {
    private final AgentModuleCheckService service;

    public AgentModuleCheckController(@Value("${JARVIS_AGENT_TESTS_ENABLED:false}") boolean enabled) {
        service = new AgentModuleCheckService(enabled);
    }

    @PostMapping("/run")
    public AgentModuleCheckService.CheckResult run(@RequestBody AgentModuleCheckService.CheckRequest request) {
        return service.check(request);
    }
}
