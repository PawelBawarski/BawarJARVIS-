package pl.bawar.jarvis.chat.api;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.NoSuchElementException;

@RestControllerAdvice(assignableTypes = ChatController.class)
public class ChatApiExceptionHandler {
    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<ApiError> notFound(NoSuchElementException exception) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ApiError("NOT_FOUND", exception.getMessage()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiError> badRequest(IllegalArgumentException exception) {
        return ResponseEntity.badRequest()
                .body(new ApiError("BAD_REQUEST", exception.getMessage()));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiError> invalidJson(HttpMessageNotReadableException exception) {
        return ResponseEntity.badRequest()
                .body(new ApiError("BAD_REQUEST", "Invalid JSON request body"));
    }

    @ExceptionHandler(LocalLlmUnavailableException.class)
    public ResponseEntity<ApiError> localModelUnavailable(LocalLlmUnavailableException exception) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(new ApiError("LLM_NOT_READY", "Lokalny model AI jest niedostępny. Sprawdź uruchomienie silnika Qwen3."));
    }

    public record ApiError(String code, String message) { }
}
