package pl.bawar.jarvis.research;

import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

/** Bounded, predictable errors for the document endpoint; no stack traces or source text in responses. */
@RestControllerAdvice(assignableTypes = DocumentMemoryController.class)
public class DocumentMemoryErrorHandler {
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> invalidDocument(IllegalArgumentException error) {
        String message = error.getMessage();
        String code = message != null && message.matches("MEMORY_DOC_[A-Z_]{3,70}")
            ? message : "MEMORY_DOC_INVALID";
        HttpStatus status = "MEMORY_DOC_ALREADY_IMPORTED".equals(code) ? HttpStatus.CONFLICT : HttpStatus.BAD_REQUEST;
        return ResponseEntity.status(status).body(Map.of("code", code));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, String>> tooLarge(MaxUploadSizeExceededException error) {
        return ResponseEntity.status(413).body(Map.of("code", "MEMORY_DOC_FILE_SIZE"));
    }
}
