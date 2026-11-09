package pl.bawar.jarvis.lab;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import java.io.IOException;

@RestControllerAdvice(assignableTypes = LabController.class)
public class LabExceptionHandler {
    @ExceptionHandler({IllegalArgumentException.class, HttpMessageNotReadableException.class})
    public ResponseEntity<Problem> badInput(Exception e) {
        return ResponseEntity.badRequest().body(new Problem("BAD_REQUEST"));
    }
    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Problem> busy(IllegalStateException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new Problem("MODEL_BUSY"));
    }
    @ExceptionHandler(IOException.class)
    public ResponseEntity<Problem> io(IOException e) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new Problem("CHECKPOINT_IO_ERROR"));
    }
    public record Problem(String code) { }
}
