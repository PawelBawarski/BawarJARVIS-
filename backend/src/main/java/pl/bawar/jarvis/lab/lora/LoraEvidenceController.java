package pl.bawar.jarvis.lab.lora;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/ai-lab/lora/evidence")
@PreAuthorize("hasAuthority('ROLE_JARVIS')")
public class LoraEvidenceController {
 private final LoraEvidenceService service;
 public LoraEvidenceController(LoraEvidenceService service){this.service=service;}
 public record SearchRequest(String query){}
 @GetMapping public List<LoraEvidenceService.Evidence> list(){return service.list();}
 @PostMapping("/search") public List<LoraEvidenceService.Evidence> search(@RequestBody SearchRequest r){return service.search(r.query());}
 @PatchMapping("/{id}") public LoraEvidenceService.Evidence review(@PathVariable String id,@RequestBody LoraEvidenceService.Review r){return service.review(id,r);}
 @PostMapping("/export") public LoraEvidenceService.Dataset export(){return service.export();}
}
