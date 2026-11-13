package pl.bawar.jarvis.agent;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.io.IOException;
import java.util.List;

/** Only authenticated, local browser requests. Each write is independently confirmed. */
@RestController
@RequestMapping("/api/agent/file-changes")
@PreAuthorize("hasAuthority('ROLE_JARVIS')")
public class AgentControlledFileController {
    private final AgentControlledFileService service;
    public AgentControlledFileController(AgentControlledFileService service) { this.service = service; }
    @GetMapping("/status") public AgentControlledFileService.Status status() { return service.status(); }
    @PostMapping("/prepare") public AgentControlledFileService.PreparedResult prepare(
        @RequestBody AgentControlledFileService.PrepareRequest request) throws IOException { return service.prepare(request); }
    @PostMapping("/apply") public AgentControlledFileService.Result apply(
        @RequestBody AgentControlledFileService.ApplyRequest request) throws IOException { return service.apply(request); }
    @PostMapping("/rollback") public AgentControlledFileService.Result rollback(
        @RequestBody AgentControlledFileService.RollbackRequest request) throws IOException { return service.rollback(request); }
    @GetMapping("/history") public List<AgentControlledFileService.Deployment> history() throws IOException {
        return service.history();
    }
}
