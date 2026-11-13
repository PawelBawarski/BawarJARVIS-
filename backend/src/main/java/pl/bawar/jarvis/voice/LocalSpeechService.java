package pl.bawar.jarvis.voice;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
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

/** Opt-in, local-only Whisper CLI. No cloud API, shell, persistent recording or auto-send. */
@Service
public final class LocalSpeechService {
    static final int SAMPLE_RATE = 16_000;
    static final int MAX_SAMPLES = SAMPLE_RATE * 15;
    private static final int MIN_SAMPLES = SAMPLE_RATE / 5;
    private static final int MAX_TEXT = 4_000;
    private static final Duration TIMEOUT = Duration.ofSeconds(70);

    @FunctionalInterface
    interface CommandRunner {
        int execute(List<String> argv, Path directory, Duration timeout) throws IOException, InterruptedException;
    }

    private final boolean enabled;
    private final Path binary;
    private final Path model;
    private final CommandRunner runner;
    private final Semaphore oneRecordingAtATime = new Semaphore(1);

    @Autowired
    public LocalSpeechService(
            @Value("${JARVIS_VOICE_ENABLED:false}") boolean enabled,
            @Value("${JARVIS_WHISPER_CLI_PATH:}") String binary,
            @Value("${JARVIS_WHISPER_MODEL_PATH:}") String model) {
        this(enabled, pathOrNull(binary), pathOrNull(model), LocalSpeechService::runNative);
    }

    LocalSpeechService(boolean enabled, Path binary, Path model, CommandRunner runner) {
        this.enabled = enabled;
        this.binary = binary;
        this.model = model;
        this.runner = runner;
    }

    public record Status(boolean enabled, boolean configured) { }
    public record Transcript(String text, String language) { }

    public Status status() { return new Status(enabled, configured()); }

    private boolean configured() {
        if (binary == null || model == null) return false;
        String name = binary.getFileName().toString().toLowerCase(Locale.ROOT);
        return (name.equals("whisper-cli.exe") || name.equals("whisper-cli"))
            && Files.isRegularFile(binary) && !Files.isSymbolicLink(binary)
            && Files.isRegularFile(model) && !Files.isSymbolicLink(model);
    }

    public Transcript transcribe(byte[] wav, String language) {
        if (!"pl".equals(language) && !"en".equals(language))
            throw new IllegalArgumentException("VOICE_LANGUAGE_INVALID");
        validateWav(wav);
        if (!enabled || !configured()) throw new IllegalStateException("VOICE_UNAVAILABLE");
        if (!oneRecordingAtATime.tryAcquire()) throw new VoiceBusyException();
        Path temporary = null;
        try {
            temporary = Files.createTempDirectory("jarvis-voice-");
            Path input = temporary.resolve("input.wav");
            Path outputPrefix = temporary.resolve("transcript");
            Files.write(input, wav, StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE);
            List<String> argv = List.of(binary.toString(), "-m", model.toString(), "-f", input.toString(),
                "-l", language, "-otxt", "-of", outputPrefix.toString(), "-nt", "-np");
            int exit = runner.execute(argv, temporary, TIMEOUT);
            if (exit != 0) throw new IllegalStateException("VOICE_TRANSCRIPTION_FAILED");
            Path result = temporary.resolve("transcript.txt");
            if (!Files.isRegularFile(result) || Files.size(result) > 16_000)
                throw new IllegalStateException("VOICE_TRANSCRIPTION_FAILED");
            String text = Files.readString(result, StandardCharsets.UTF_8).strip();
            if (text.isEmpty() || text.length() > MAX_TEXT)
                throw new IllegalStateException("VOICE_TRANSCRIPTION_FAILED");
            return new Transcript(text, language);
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("VOICE_TRANSCRIPTION_FAILED");
        } catch (IOException io) {
            throw new IllegalStateException("VOICE_TRANSCRIPTION_FAILED");
        } finally {
            if (temporary != null) {
                try (var files = Files.walk(temporary)) {
                    for (Path file : files.sorted(Comparator.reverseOrder()).toList()) Files.deleteIfExists(file);
                } catch (IOException ignored) { /* Windows antivirus can briefly hold a temporary file */ }
            }
            oneRecordingAtATime.release();
        }
    }

    /** A single fixed-layout PCM16 mono WAV, not arbitrary media/container content. */
    static void validateWav(byte[] wav) {
        if (wav == null || wav.length < 44 + MIN_SAMPLES * 2 || wav.length > 44 + MAX_SAMPLES * 2)
            throw new IllegalArgumentException("VOICE_AUDIO_INVALID");
        if (!ascii(wav, 0, "RIFF") || !ascii(wav, 8, "WAVE") || !ascii(wav, 12, "fmt ")
                || !ascii(wav, 36, "data")) throw new IllegalArgumentException("VOICE_AUDIO_INVALID");
        ByteBuffer b = ByteBuffer.wrap(wav).order(ByteOrder.LITTLE_ENDIAN);
        int dataLength = wav.length - 44;
        if (b.getInt(4) != wav.length - 8 || b.getInt(16) != 16 || b.getShort(20) != 1
            || b.getShort(22) != 1 || b.getInt(24) != SAMPLE_RATE || b.getInt(28) != SAMPLE_RATE * 2
            || b.getShort(32) != 2 || b.getShort(34) != 16 || b.getInt(40) != dataLength
            || (dataLength & 1) != 0) throw new IllegalArgumentException("VOICE_AUDIO_INVALID");
    }

    private static boolean ascii(byte[] value, int from, String marker) {
        byte[] bytes = marker.getBytes(StandardCharsets.US_ASCII);
        for (int i = 0; i < bytes.length; i++) if (value[from + i] != bytes[i]) return false;
        return true;
    }

    private static Path pathOrNull(String raw) {
        return raw == null || raw.isBlank() ? null : Path.of(raw.trim()).toAbsolutePath().normalize();
    }

    private static int runNative(List<String> argv, Path cwd, Duration timeout) throws IOException, InterruptedException {
        ProcessBuilder pb = new ProcessBuilder(new ArrayList<>(argv));
        pb.directory(cwd.toFile());
        pb.redirectOutput(ProcessBuilder.Redirect.DISCARD);
        pb.redirectError(ProcessBuilder.Redirect.DISCARD);
        // Never forward database passwords, LLM tokens or other secrets to Whisper.
        Set<String> allowed = Set.of("PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "HOME", "USERPROFILE");
        pb.environment().keySet().removeIf(key -> !allowed.contains(key.toUpperCase(Locale.ROOT)));
        Process process = pb.start();
        try {
            if (!process.waitFor(timeout.toMillis(), TimeUnit.MILLISECONDS)) {
                process.descendants().forEach(child -> child.destroyForcibly());
                process.destroyForcibly();
                process.waitFor(3, TimeUnit.SECONDS);
                throw new IOException("VOICE_TIMEOUT");
            }
            return process.exitValue();
        } catch (InterruptedException e) {
            process.destroyForcibly();
            throw e;
        }
    }

    public static final class VoiceBusyException extends RuntimeException {
        public VoiceBusyException() { super("VOICE_BUSY"); }
    }
}
