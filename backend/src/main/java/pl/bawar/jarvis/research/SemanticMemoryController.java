package pl.bawar.jarvis.research;

import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestController
@RequestMapping("/api/research/semantic")
@PreAuthorize("hasAuthority('ROLE_JARVIS')")
public class SemanticMemoryController {
    private final SemanticMemoryService semantic;
    private final KnowledgeMemoryService memory;
    public SemanticMemoryController(SemanticMemoryService semantic, KnowledgeMemoryService memory) {
        this.semantic = semantic;
        this.memory = memory;
    }
    @GetMapping("/status")
    public SemanticMemoryService.Status status() { return semantic.status(); }

    @GetMapping("/search")
    public List<SemanticMemoryService.Hit> search(@RequestParam("q") String question) {
        return semantic.find(question, memory);
    }

    @PostMapping("/index-next")
    public SemanticMemoryService.Indexed indexNext() { return semantic.indexNextBatch(); }
}

@RestControllerAdvice(assignableTypes = SemanticMemoryController.class)
class SemanticMemoryErrorHandler {
    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<Map<String, String>> badRequest(IllegalArgumentException error) {
        String code = error.getMessage();
        if (!"SEMANTIC_QUERY_INVALID".equals(code) && !"SEMANTIC_DISABLED".equals(code))
            code = "SEMANTIC_INVALID_REQUEST";
        return ResponseEntity.badRequest().body(Map.of("code", code));
    }

    @ExceptionHandler(LocalEmbeddingClient.SemanticUnavailableException.class)
    ResponseEntity<Map<String, String>> modelUnavailable(RuntimeException error) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
            .body(Map.of("code", "SEMANTIC_MODEL_UNAVAILABLE"));
    }
}
