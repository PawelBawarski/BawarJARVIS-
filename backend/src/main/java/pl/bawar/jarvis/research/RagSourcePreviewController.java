package pl.bawar.jarvis.research;

import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** Authenticated, read-only, on-demand retrieval preview for the Chat user. */
@RestController
@RequestMapping("/api/research/context")
@PreAuthorize("hasAuthority('ROLE_JARVIS')")
public class RagSourcePreviewController {
    private final RagSourcePreviewService service;

    public RagSourcePreviewController(RagSourcePreviewService service) { this.service = service; }

    public record PreviewRequest(String question) { }

    @PostMapping("/preview")
    public RagSourcePreviewService.Preview preview(@RequestBody(required = false) PreviewRequest request) {
        return service.preview(request == null ? null : request.question());
    }
}

@RestControllerAdvice(assignableTypes = RagSourcePreviewController.class)
class RagSourcePreviewErrorHandler {
    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<Map<String, String>> invalid(IllegalArgumentException error) {
        return ResponseEntity.badRequest().body(Map.of("code", "RAG_SOURCE_QUERY_INVALID"));
    }
}
