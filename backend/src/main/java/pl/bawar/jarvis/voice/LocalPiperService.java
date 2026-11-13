package pl.bawar.jarvis.voice;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/** Explicit, local-only synthesis. Never executes text as a command or saves audio permanently. */
@Service
public final class LocalPiperService {
    static final int MAX_TEXT = 1_200;
    static final int MAX_WAV_BYTES = 8 * 1024 * 1024;
    private static final Duration TIMEOUT = Duration.ofSeconds(50);

    @FunctionalInterface
    interface Runner {
        int run(List<String> command, String text, Path workingDir, Duration timeout)
            throws IOException, InterruptedException;
    }

    private final boolean enabled;
    private final Path binary;
    private final Path polish;
    private final Path english;
    private final Runner runner;
    private final Semaphore exclusive = new Semaphore(1);

    @Autowired
    public LocalPiperService(
        @Value("${JARVIS_PIPER_ENABLED:false}") boolean enabled,
        @Value("${JARVIS_PIPER_PATH:}") String binary,
        @Value("${JARVIS_PIPER_MODEL_PL:}") String polish,
        @Value("${JARVIS_PIPER_MODEL_EN:}") String english) {
        this(enabled, fileOrNull(binary), fileOrNull(polish), fileOrNull(english), LocalPiperService::runNative);
    }

    LocalPiperService(boolean enabled, Path binary, Path polish, Path english, Runner runner) {
        this.enabled = enabled;
        this.binary = binary;
        this.polish = polish;
        this.english = english;
        this.runner = runner;
    }

    public record Status(boolean enabled, boolean configuredPl, boolean configuredEn) { }

    public Status status() {
        boolean binaryPresent = validBinary();
        return new Status(enabled, binaryPresent && validModel(polish), binaryPresent && validModel(english));
    }

    public byte[] synthesize(String text, String language) {
        if (!"pl".equals(language) && !"en".equals(language))
            throw new IllegalArgumentException("TTS_LANGUAGE_INVALID");
        if (text == null || text.isBlank() || text.length() > MAX_TEXT || text.indexOf('\0') >= 0)
            throw new IllegalArgumentException("TTS_TEXT_INVALID");
        // Strip only surrounding whitespace; never interpret shell operators or escape sequences.
        String spoken = text.strip();
        Path model = "pl".equals(language) ? polish : english;
        if (!enabled || !validBinary() || !validModel(model))
            throw new IllegalStateException("TTS_UNAVAILABLE");
        if (!exclusive.tryAcquire()) throw new Busy();
        Path dir = null;
        try {
            dir = Files.createTempDirectory("jarvis-piper-");
            Path wav = dir.resolve("speech.wav");
            List<String> argv = List.of(binary.toString(), "--model", model.toString(),
                "--output_file", wav.toString());
            if (runner.run(argv, spoken, dir, TIMEOUT) != 0 || !Files.isRegularFile(wav) ||
                Files.size(wav) < 44 || Files.size(wav) > MAX_WAV_BYTES)
                throw new IllegalStateException("TTS_SYNTHESIS_FAILED");
            byte[] result = Files.readAllBytes(wav);
            if (!isWav(result)) throw new IllegalStateException("TTS_SYNTHESIS_FAILED");
            return result;
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("TTS_SYNTHESIS_FAILED", error);
        } catch (IOException error) {
            throw new IllegalStateException("TTS_SYNTHESIS_FAILED", error);
        } finally {
            if (dir != null) {
                try (var paths = Files.walk(dir)) {
                    for (Path path : paths.sorted(Comparator.reverseOrder()).toList()) Files.deleteIfExists(path);
                } catch (IOException ignored) { /* Windows may hold file briefly */ }
            }
            exclusive.release();
        }
    }

    static boolean isWav(byte[] b) {
        return b.length >= 44 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
            && b[8] == 'W' && b[9] == 'A' && b[10] == 'V' && b[11] == 'E'
            && b[36] == 'd' && b[37] == 'a' && b[38] == 't' && b[39] == 'a';
    }

    private boolean validBinary() {
        if (binary == null) return false;
        String base = binary.getFileName().toString().toLowerCase(Locale.ROOT);
        return (base.equals("piper.exe") || base.equals("piper"))
            && Files.isRegularFile(binary) && !Files.isSymbolicLink(binary);
    }

    private static boolean validModel(Path path) {
        return path != null && path.getFileName().toString().endsWith(".onnx")
            && Files.isRegularFile(path) && !Files.isSymbolicLink(path)
            && Files.isRegularFile(Path.of(path + ".json"))
            && !Files.isSymbolicLink(Path.of(path + ".json"));
    }

    private static Path fileOrNull(String raw) {
        return raw == null || raw.isBlank() ? null : Path.of(raw.strip()).toAbsolutePath().normalize();
    }

    private static int runNative(List<String> args, String text, Path dir, Duration timeout)
        throws IOException, InterruptedException {
        ProcessBuilder builder = new ProcessBuilder(new ArrayList<>(args));
        builder.directory(dir.toFile());
        builder.redirectOutput(ProcessBuilder.Redirect.DISCARD);
        builder.redirectError(ProcessBuilder.Redirect.DISCARD);
        Set<String> allowed = Set.of("PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "HOME", "USERPROFILE");
        builder.environment().keySet().removeIf(key -> !allowed.contains(key.toUpperCase(Locale.ROOT)));
        Process process = builder.start();
        try {
            try (OutputStream input = process.getOutputStream()) {
                input.write((text + "\n").getBytes(StandardCharsets.UTF_8));
            }
            if (!process.waitFor(timeout.toMillis(), TimeUnit.MILLISECONDS)) {
                process.descendants().forEach(child -> child.destroyForcibly());
                process.destroyForcibly();
                process.waitFor(3, TimeUnit.SECONDS);
                throw new IOException("TTS_TIMEOUT");
            }
            return process.exitValue();
        } catch (InterruptedException | IOException error) {
            process.destroyForcibly();
            throw error;
        }
    }

    public static final class Busy extends RuntimeException {
        public Busy() { super("TTS_BUSY"); }
    }
}
