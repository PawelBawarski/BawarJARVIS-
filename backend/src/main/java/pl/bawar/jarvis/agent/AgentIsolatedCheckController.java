package pl.bawar.jarvis.agent;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 19.2: Docker-only code checks; never writes to or mounts the workspace. */
@RestController
@RequestMapping("/api/agent/isolated-checks")
@PreAuthorize("hasAuthority('ROLE_JARVIS')")
public class AgentIsolatedCheckController {
    private final AgentIsolatedCheckService service;
    public AgentIsolatedCheckController(@Value("${JARVIS_AGENT_TESTS_ENABLED:false}") boolean enabled) {
        this.service = new AgentIsolatedCheckService(enabled);
    }
    @GetMapping("/status") public AgentIsolatedCheckService.Status status() { return service.status(); }
    @PostMapping("/run") public AgentIsolatedCheckService.CheckResult run(
        @RequestBody AgentIsolatedCheckService.CheckRequest request) { return service.check(request); }
}
