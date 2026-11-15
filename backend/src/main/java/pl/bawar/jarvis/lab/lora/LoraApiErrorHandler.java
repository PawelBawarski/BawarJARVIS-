package pl.bawar.jarvis.lab.lora;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import java.util.Map;

/** Safe, stable API errors, without leaking local paths or process details. */
@RestControllerAdvice(assignableTypes = {LoraTrainingController.class, LoraEvidenceController.class})
public class LoraApiErrorHandler {
    @ExceptionHandler({IllegalArgumentException.class, HttpMessageNotReadableException.class})
    public ResponseEntity<Map<String,String>> badRequest(Exception ex) {
        return ResponseEntity.badRequest().body(Map.of("code","BAD_REQUEST"));
    }
    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String,String>> state(IllegalStateException ex) {
        String code = ex.getMessage();
        if ("LORA_TRAINING_DISABLED".equals(code))
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("code",code));
        if ("LORA_ALREADY_RUNNING".equals(code))
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("code",code));
        if ("INTERNET_ACCESS_DISABLED_IN_SETTINGS".equals(code))
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("code",code));
        if ("REQUIRES_TWO_APPROVED_EXAMPLES".equals(code))
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("code",code));
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("code","LORA_UNAVAILABLE"));
    }
}
