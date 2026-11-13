package pl.bawar.jarvis.voice;

import java.util.Map;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestController
@RequestMapping("/api/ai-lab/tts")
@PreAuthorize("hasAuthority('ROLE_JARVIS')")
public class LocalTtsController {
    private final LocalPiperService piper;

    public LocalTtsController(LocalPiperService piper) { this.piper = piper; }
    public record Request(String text, String language) { }

    @GetMapping("/status")
    public LocalPiperService.Status status() { return piper.status(); }

    @PostMapping(value = "/synthesize", consumes = MediaType.APPLICATION_JSON_VALUE,
        produces = "audio/wav")
    public ResponseEntity<byte[]> synthesize(@RequestBody Request request) {
        byte[] wav = piper.synthesize(request.text(), request.language());
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_TYPE, "audio/wav")
            .cacheControl(CacheControl.noStore())
            .body(wav);
    }
}

@RestControllerAdvice(assignableTypes = LocalTtsController.class)
class LocalTtsErrors {
    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<Map<String, String>> badRequest(IllegalArgumentException error) {
        return ResponseEntity.badRequest().body(Map.of("code", error.getMessage()));
    }

    @ExceptionHandler(LocalPiperService.Busy.class)
    ResponseEntity<Map<String, String>> busy() {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(Map.of("code", "TTS_BUSY"));
    }

    @ExceptionHandler(IllegalStateException.class)
    ResponseEntity<Map<String, String>> unavailable(IllegalStateException error) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
            .body(Map.of("code", error.getMessage()));
    }
}
