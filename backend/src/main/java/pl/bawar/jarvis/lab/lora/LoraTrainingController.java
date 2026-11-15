package pl.bawar.jarvis.lab.lora;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

/** Separate Qwen LoRA training, not Java experimental Transformer training. */
@RestController
@RequestMapping("/api/ai-lab/lora")
@PreAuthorize("hasAuthority('ROLE_JARVIS')")
public class LoraTrainingController {
    private final LoraTrainingService service;
    public LoraTrainingController(LoraTrainingService service) { this.service = service; }
    public record StartRequest(Integer steps, Integer seqLen, String datasetId) {
        public StartRequest(Integer steps, Integer seqLen) { this(steps,seqLen,null); }
    }
    @GetMapping("/status") public LoraTrainingService.Run status() { return service.status(); }
    @GetMapping("/history") public List<LoraTrainingService.Run> history() { return service.history(); }
    @PostMapping("/start") public LoraTrainingService.Run start(@RequestBody StartRequest request) {
        if (request == null || request.steps() == null || request.seqLen() == null)
            throw new IllegalArgumentException("Missing training parameters");
        return request.datasetId()==null || request.datasetId().isBlank()
            ? service.start(request.steps(),request.seqLen())
            : service.startReviewed(request.steps(),request.seqLen(),request.datasetId());
    }
    @GetMapping("/datasets") public java.util.List<LoraTrainingService.DatasetInfo> datasets() { return service.datasets(); }
    @PostMapping("/stop") public LoraTrainingService.Run stop() { return service.stop(); }
}
