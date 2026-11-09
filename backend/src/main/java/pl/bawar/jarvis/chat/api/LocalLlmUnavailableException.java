package pl.bawar.jarvis.chat.api;

/** Safe public error; never contains the API key, prompts, paths or model internals. */
public class LocalLlmUnavailableException extends RuntimeException {
    public LocalLlmUnavailableException(String message) { super(message); }
    public LocalLlmUnavailableException(String message, Throwable cause) { super(message, cause); }
}
