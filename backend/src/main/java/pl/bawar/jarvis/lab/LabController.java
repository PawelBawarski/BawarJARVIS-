package pl.bawar.jarvis.lab;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import pl.bawar.jarvis.brain.training.EvaluationMetrics;
import pl.bawar.jarvis.runtime.ModelStatus;
import java.io.IOException;
import java.util.List;

/** Private desktop-only API. HTTP security + method security are both required. */
@RestController
@RequestMapping("/api/ai-lab")
@PreAuthorize("hasAuthority('ROLE_JARVIS')")
public class LabController {
    private final LabTrainingService service;

    public LabController(LabTrainingService service) { this.service = service; }

    @GetMapping("/training")
    public LabTrainingService.TrainingState training() { return service.progress(); }

    @GetMapping("/model")
    public ModelStatus model() { return service.modelStatus(); }

    @PostMapping("/training")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public LabTrainingService.TrainingState start(@RequestBody TrainRequest request) {
        if (request == null) throw new IllegalArgumentException("Missing body");
        return service.start(request.examples(), request.epochs());
    }

    @PostMapping("/checkpoint/save")
    public ModelStatus save() throws IOException { service.save(); return service.modelStatus(); }

    @PostMapping("/checkpoint/load")
    public ModelStatus load() throws IOException { service.load(); return service.modelStatus(); }

    @PostMapping("/evaluate")
    public EvaluationMetrics evaluate(@RequestBody EvaluateRequest request) {
        if (request == null) throw new IllegalArgumentException("Missing body");
        return service.evaluate(request.examples());
    }

    public record TrainRequest(List<String> examples, int epochs) { }
    public record EvaluateRequest(List<String> examples) { }
}
