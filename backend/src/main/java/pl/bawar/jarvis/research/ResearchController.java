package pl.bawar.jarvis.research;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/research")
@PreAuthorize("hasAuthority('ROLE_JARVIS')")
public class ResearchController {
    private final KnowledgeMemoryService memory;
    public ResearchController(KnowledgeMemoryService memory) { this.memory = memory; }
    public record SearchRequest(String query, String language) { }
    public record SaveRequest(String title, String language) { }
    @PostMapping("/search")
    public List<WikipediaClient.Hit> search(@RequestBody SearchRequest req) {
        if (req == null) throw new IllegalArgumentException("Missing search");
        return memory.search(req.query(), req.language());
    }
    @PostMapping("/save")
    public KnowledgeMemoryService.Note save(@RequestBody SaveRequest req) {
        if (req == null) throw new IllegalArgumentException("Missing article");
        return memory.approve(req.title(), req.language());
    }
    @GetMapping
    public List<KnowledgeMemoryService.Note> list() { return memory.list(); }
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        if (memory.remove(id)) return ResponseEntity.noContent().<Void>build();
        return ResponseEntity.notFound().<Void>build();
    }
}
