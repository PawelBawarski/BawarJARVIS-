package pl.bawar.jarvis.agent;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Local authenticated preview only; no patch application endpoint exists. */
@RestController
@RequestMapping("/api/agent/patch-preview")
@PreAuthorize("hasAuthority('ROLE_JARVIS')")
public class AgentPatchPreviewController {
    private final AgentPatchPreviewService service;

    public AgentPatchPreviewController(AgentPatchPreviewService service) {
        this.service = service;
    }

    @PostMapping
    public AgentPatchPreviewService.PatchPreview preview(@RequestBody PatchRequest input) {
        return service.preview(input == null ? null : input.task(), input == null ? null : input.source());
    }

    public record PatchRequest(String task, AgentCodeSource source) { }
}
