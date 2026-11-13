package pl.bawar.jarvis.research;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/research/documents")
@PreAuthorize("hasAuthority('ROLE_JARVIS')")
public class DocumentMemoryController {
    private final DocumentMemoryService service;
    public DocumentMemoryController(DocumentMemoryService service) { this.service = service; }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<DocumentMemoryService.DocumentInfo> upload(@RequestPart("file") MultipartFile file) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.importDocument(file));
    }

    @GetMapping
    public List<DocumentMemoryService.DocumentInfo> list() { return service.list(); }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        return service.remove(id) ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }
}
