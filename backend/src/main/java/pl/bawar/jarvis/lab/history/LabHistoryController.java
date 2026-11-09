package pl.bawar.jarvis.lab.history;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** Read-only, private desktop API. Never return file paths or raw corpora. */
@RestController
@RequestMapping("/api/ai-lab/history")
@PreAuthorize("hasAuthority('ROLE_JARVIS')")
public class LabHistoryController {
    private final LabHistoryService history;
    public LabHistoryController(LabHistoryService history) { this.history = history; }

    @GetMapping("/runs")
    public List<LabHistoryRepository.Run> runs() { return history.runs(); }

    @GetMapping("/runs/{id}/epochs")
    public List<LabHistoryRepository.Epoch> epochs(@PathVariable UUID id) { return history.epochs(id); }

    @GetMapping("/checkpoints")
    public List<LabHistoryRepository.Checkpoint> checkpoints() { return history.checkpoints(); }

    @GetMapping("/evaluations")
    public List<LabHistoryRepository.Evaluation> evaluations() { return history.evaluations(); }
}
