package pl.bawar.jarvis.radio;

import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestController
@RequestMapping("/api/radio")
@PreAuthorize("hasAuthority('ROLE_JARVIS')")
public class RadioCatalogController {
    private final RadioCatalogService service;
    public RadioCatalogController(RadioCatalogService service) { this.service = service; }
    @GetMapping("/stations")
    public List<RadioCatalogService.Station> stations(@RequestParam(defaultValue = "PL") String country) {
        return service.stations(country);
    }
}

@RestControllerAdvice(assignableTypes = RadioCatalogController.class)
class RadioCatalogErrors {
    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<Map<String,String>> invalid() {
        return ResponseEntity.badRequest().body(Map.of("code", "RADIO_COUNTRY_INVALID"));
    }
    @ExceptionHandler(IllegalStateException.class)
    ResponseEntity<Map<String,String>> unavailable() {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of("code", "RADIO_DIRECTORY_UNAVAILABLE"));
    }
}
