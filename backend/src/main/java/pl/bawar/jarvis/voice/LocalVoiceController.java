package pl.bawar.jarvis.voice;

import java.io.IOException;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MultipartFile;

/** Existing authenticated /api/ai-lab/** route: the browser never holds the session secret. */
@RestController
@RequestMapping("/api/ai-lab/voice")
@PreAuthorize("hasAuthority('ROLE_JARVIS')")
public class LocalVoiceController {
    private final LocalSpeechService service;

    public LocalVoiceController(LocalSpeechService service) { this.service = service; }

    @GetMapping("/status")
    public LocalSpeechService.Status status() { return service.status(); }

    @PostMapping(value = "/transcribe", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public LocalSpeechService.Transcript transcribe(
            @RequestPart("file") MultipartFile file,
            @RequestParam(defaultValue = "pl") String language) throws IOException {
        if (file.isEmpty() || file.getSize() > 44 + LocalSpeechService.MAX_SAMPLES * 2L)
            throw new IllegalArgumentException("VOICE_AUDIO_INVALID");
        return service.transcribe(file.getBytes(), language);
    }
}

@RestControllerAdvice(assignableTypes = LocalVoiceController.class)
class LocalVoiceErrors {
    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<Map<String, String>> invalid() {
        return ResponseEntity.badRequest().body(Map.of("code", "VOICE_AUDIO_INVALID"));
    }
    @ExceptionHandler(LocalSpeechService.VoiceBusyException.class)
    ResponseEntity<Map<String, String>> busy() {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(Map.of("code", "VOICE_BUSY"));
    }
    @ExceptionHandler(IllegalStateException.class)
    ResponseEntity<Map<String, String>> unavailable() {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("code", "VOICE_UNAVAILABLE"));
    }
    @ExceptionHandler(IOException.class)
    ResponseEntity<Map<String, String>> failed() {
        return ResponseEntity.badRequest().body(Map.of("code", "VOICE_AUDIO_INVALID"));
    }
}
