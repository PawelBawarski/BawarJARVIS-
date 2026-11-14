package pl.bawar.jarvis.lab.dataset;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@RestControllerAdvice(assignableTypes = DatasetController.class)
public class DatasetErrorHandler {

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> invalid(
            IllegalArgumentException exception) {

        String message = exception.getMessage();

        if ("Unknown dataset".equals(message)
                || "Unknown dataset version".equals(message)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("code", "NOT_FOUND"));
        }

        return ResponseEntity.badRequest()
            .body(Map.of("code", "BAD_REQUEST"));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, String>> invalidJson(
            HttpMessageNotReadableException exception) {
        return ResponseEntity.badRequest()
            .body(Map.of("code", "BAD_REQUEST"));
    }
}
