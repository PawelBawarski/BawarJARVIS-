package pl.bawar.jarvis.agent;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import java.io.IOException;
import java.util.Map;

@RestControllerAdvice(assignableTypes = AgentControlledFileController.class)
public class AgentControlledFileErrorHandler {
    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<Map<String, String>> invalid(IllegalArgumentException error) {
        return ResponseEntity.badRequest().body(Map.of("code", error.getMessage()));
    }
    @ExceptionHandler(IllegalStateException.class)
    ResponseEntity<Map<String, String>> conflict(IllegalStateException error) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("code", error.getMessage()));
    }
    @ExceptionHandler(IOException.class)
    ResponseEntity<Map<String, String>> io(IOException error) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("code", "FILE_ACCESS_FAILED"));
    }
}
