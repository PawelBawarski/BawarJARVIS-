package pl.bawar.jarvis.agent;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;
import java.util.UUID;

/** Only the authenticated local desktop session can access plans. */
@RestController
@RequestMapping("/api/agent/proposals")
@PreAuthorize("hasAuthority('ROLE_JARVIS')")
public class AgentProposalController {
    private final AgentProposalService service;

    public AgentProposalController(AgentProposalService service) {
        this.service = service;
    }

    @GetMapping
    public List<AgentProposal> list() {
        return service.list();
    }

    @PostMapping
    public ResponseEntity<AgentProposal> generate(@RequestBody GenerateRequest input) {
        AgentProposal created = service.generate(input == null ? null : input.task(), input == null ? null : input.sources());
        return ResponseEntity.created(URI.create("/api/agent/proposals/" + created.id())).body(created);
    }

    @PostMapping("/{id}/decision")
    public AgentProposal decide(@PathVariable UUID id, @RequestBody DecisionRequest input) {
        return service.decide(id, input == null ? null : input.decision());
    }

    @PostMapping("/{id}/revise")
    public AgentProposal revise(@PathVariable UUID id, @RequestBody RevisionRequest input) {
        return service.revise(id, input == null ? null : input.feedback());
    }

    public record GenerateRequest(String task, List<AgentCodeSource> sources) { }
    public record DecisionRequest(String decision) { }
    public record RevisionRequest(String feedback) { }
}
