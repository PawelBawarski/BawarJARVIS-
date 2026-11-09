package pl.bawar.jarvis.lab.dataset;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** Authenticated desktop API. No uploads, URLs, filesystem paths or deletion endpoints. */
@RestController
@RequestMapping("/api/ai-lab/datasets")
@PreAuthorize("hasAuthority('ROLE_JARVIS')")
public class DatasetController {
    private final DatasetService service;
    public DatasetController(DatasetService service) { this.service = service; }

    public record CreateRequest(String name, List<String> examples) { }
    public record ReviseRequest(List<String> examples) { }

    @GetMapping
    public List<DatasetRepository.Summary> list() { return service.listDatasets(); }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public DatasetRepository.Version create(@RequestBody CreateRequest request) {
        if (request == null) throw new IllegalArgumentException("Missing dataset");
        return service.create(request.name(), request.examples());
    }

    @GetMapping("/{id}/versions")
    public List<DatasetRepository.Version> versions(@PathVariable UUID id) {
        return service.versions(id);
    }

    @PostMapping("/{id}/versions")
    @ResponseStatus(HttpStatus.CREATED)
    public DatasetRepository.Version revise(@PathVariable UUID id, @RequestBody ReviseRequest request) {
        if (request == null) throw new IllegalArgumentException("Missing examples");
        return service.newVersion(id, request.examples());
    }

    @GetMapping("/versions/{versionId}")
    public DatasetRepository.Samples readVersion(@PathVariable UUID versionId) {
        return service.readVersion(versionId);
    }
}
