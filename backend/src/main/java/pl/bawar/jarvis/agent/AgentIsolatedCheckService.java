package pl.bawar.jarvis.agent;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;

/** Opt-in, bounded validation of ONE proposed file. Never touches the real workspace. */
public final class AgentIsolatedCheckService {
    private static final int MAX_SOURCE_BYTES = 16_384;
    private static final int MAX_OUTPUT_BYTES = 12_000;
    private static final long TIMEOUT_SECONDS = 20;
    private final boolean enabled;
    private final Execution executor;
    private final Semaphore singleCheck = new Semaphore(1);

    public AgentIsolatedCheckService(boolean enabled) { this(enabled, new DockerExecution()); }
    AgentIsolatedCheckService(boolean enabled, Execution executor) {
        this.enabled = enabled;
        this.executor = executor;
    }

    public record Status(boolean enabled, String notice) { }
    public record CheckRequest(String relativePath, String original, String proposed) { }
    public record CheckResult(String checkId, String relativePath, String proposedSha256,
            String kind, String status, String summary, String output, long elapsedMs) { }
    record Outcome(String status, String output) { }
    interface Execution { Outcome check(Kind kind, String filename, byte[] content) throws IOException, InterruptedException; }
    enum Kind { JAVA_COMPILE, JS_SYNTAX, TS_SYNTAX, JS_TEST }

    public Status status() {
        return new Status(enabled, enabled
            ? "Weryfikacja jednego pliku w Docker; obrazy muszą być wcześniej pobrane."
            : "Izolowane kontrole są wyłączone w konfiguracji serwera.");
    }

    public CheckResult check(CheckRequest request) {
        if (!enabled) throw new IllegalStateException("ISOLATED_CHECK_DISABLED");
        if (request == null || !AgentSourceContext.validPath(request.relativePath()) ||
                request.original() == null || request.proposed() == null ||
                request.original().isBlank() || request.proposed().isBlank() ||
                request.original().equals(request.proposed()) || request.proposed().indexOf('\0') >= 0 ||
                request.original().length() > MAX_SOURCE_BYTES || request.proposed().length() > MAX_SOURCE_BYTES) {
            throw new IllegalArgumentException("INVALID_TEST_PREVIEW");
        }
        byte[] bytes = request.proposed().getBytes(StandardCharsets.UTF_8);
        if (bytes.length > MAX_SOURCE_BYTES) throw new IllegalArgumentException("TEST_SOURCE_TOO_LARGE");
        String filename = request.relativePath().substring(request.relativePath().lastIndexOf('/') + 1);
        Kind kind = kindFor(filename);
        if (kind == null) throw new IllegalArgumentException("UNSUPPORTED_TEST_FILE");
        if (!singleCheck.tryAcquire()) throw new IllegalStateException("TEST_ALREADY_RUNNING");
        long started = System.nanoTime();
        try {
            Outcome outcome = executor.check(kind, filename, bytes);
            return new CheckResult(UUID.randomUUID().toString(), request.relativePath(), sha256(bytes),
                kind.name(), outcome.status(), description(kind, outcome.status()), outcome.output(),
                Duration.ofNanos(System.nanoTime() - started).toMillis());
        } catch (IOException e) {
            return resultError(request.relativePath(), bytes, kind, started, "unavailable", "Docker jest niedostępny lub brakuje obrazu.");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return resultError(request.relativePath(), bytes, kind, started, "unavailable", "Kontrola została przerwana.");
        } finally { singleCheck.release(); }
    }

    private CheckResult resultError(String path, byte[] bytes, Kind kind, long start, String status, String message) {
        return new CheckResult(UUID.randomUUID().toString(), path, sha256(bytes), kind.name(), status,
            message, "", Duration.ofNanos(System.nanoTime() - start).toMillis());
    }
    static Kind kindFor(String name) {
        String lower = name.toLowerCase(java.util.Locale.ROOT);
        if (lower.endsWith(".java")) return Kind.JAVA_COMPILE;
        if (lower.endsWith(".ts")) return Kind.TS_SYNTAX;
        if (lower.endsWith(".js") || lower.endsWith(".cjs")) {
            if (lower.endsWith(".test.js") || lower.endsWith(".spec.js") ||
                lower.endsWith(".test.cjs") || lower.endsWith(".spec.cjs")) return Kind.JS_TEST;
            return Kind.JS_SYNTAX;
        }
        return null;
    }
    private static String description(Kind kind, String status) {
        if ("timeout".equals(status)) return "Przekroczono limit czasu kontroli.";
        if ("unavailable".equals(status)) return "Docker lub wymagany obraz jest niedostępny.";
        String operation = switch (kind) {
            case JAVA_COMPILE -> "Kompilacja samodzielnego pliku Java (bez zależności projektu)";
            case TS_SYNTAX -> "Parser TypeScript (bez kontroli typów i kompilacji Angulara)";
            case JS_SYNTAX -> "Sprawdzenie składni JavaScript (bez wykonywania kodu)";
            case JS_TEST -> "Uruchomienie jednego pliku testowego Node.js w kontenerze";
        };
        return operation + ("passed".equals(status) ? ": PASS" : ": FAIL");
    }
    static String sha256(byte[] value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value)); }
        catch (NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }

    /** Docker is not a perfect security boundary; only suitable for local, explicitly trusted dev machines. */
    static final class DockerExecution implements Execution {
        @Override public Outcome check(Kind kind, String filename, byte[] source) throws IOException, InterruptedException {
            String name = "jarvis-check-" + UUID.randomUUID().toString().replace("-", "");
            List<String> command = dockerCommand(kind, filename, name);
            ProcessBuilder pb = new ProcessBuilder(command).redirectErrorStream(true);
            // Never forward database/model/API secrets from the Java process to the docker CLI.
            var env = pb.environment();
            env.entrySet().removeIf(e -> e.getKey().startsWith("JARVIS_") || e.getKey().contains("PASSWORD") ||
                e.getKey().contains("TOKEN") || e.getKey().contains("SECRET") || e.getKey().contains("KEY"));
            Process proc = pb.start();
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            Thread drain = Thread.startVirtualThread(() -> readBounded(proc.getInputStream(), output));
            boolean completed = false;
            try {
                // Docker startup can stall; feed stdin asynchronously so the deadline starts immediately.
                Thread feed = Thread.startVirtualThread(() -> {
                    try (var stdin = proc.getOutputStream()) { stdin.write(source); }
                    catch (IOException ignored) { /* docker failed or timeout closed stdin */ }
                });
                completed = proc.waitFor(TIMEOUT_SECONDS, TimeUnit.SECONDS);
                if (!completed) {
                    proc.destroyForcibly();
                    drain.join(1000);
                    return new Outcome("timeout", crop(output));
                }
                feed.join(1000);
                drain.join(1000);
                return new Outcome(proc.exitValue() == 0 ? "passed" : proc.exitValue() == 125 ? "unavailable" : "failed", crop(output));
            } finally {
                if (proc.isAlive()) proc.destroyForcibly();
                // Only failed/incomplete runs need an additional forced container removal.
                if (!completed) forceRemove(name);
            }
        }

        static List<String> dockerCommand(Kind kind, String filename, String name) {
            String image = kind == Kind.JAVA_COMPILE ? "eclipse-temurin:21-jdk-alpine" : "node:22-alpine";
            List<String> command = new ArrayList<>(List.of("docker", "run", "--rm", "-i", "--pull=never",
                "--name", name, "--network", "none", "--read-only", "--cap-drop=ALL",
                "--security-opt", "no-new-privileges", "--pids-limit", "64", "--cpus", "1",
                "--memory", "384m", "--memory-swap", "384m", "--user", "65534:65534",
                "--tmpfs", "/tmp:rw,nosuid,nodev,noexec,size=64m,mode=1777",
                "--workdir", "/tmp", "--entrypoint", "/bin/sh", image, "-c"));
            // Script is fixed server code; user content enters ONLY via stdin (never shell arguments).
            String fixedScript = switch (kind) {
                case JAVA_COMPILE -> "cat > \"$1\" && javac -proc:none -encoding UTF-8 -d /tmp \"./$1\"";
                case TS_SYNTAX -> "cat > /tmp/proposed.ts && node --disable-warning=ExperimentalWarning -e 'require(\"node:module\").stripTypeScriptTypes(require(\"node:fs\").readFileSync(\"/tmp/proposed.ts\",\"utf8\"))'";
                case JS_SYNTAX -> "cat > /tmp/proposed.js && node --check /tmp/proposed.js";
                case JS_TEST -> filename.toLowerCase(java.util.Locale.ROOT).endsWith(".cjs")
                    ? "cat > /tmp/proposed.test.cjs && node --test /tmp/proposed.test.cjs"
                    : "cat > /tmp/proposed.test.js && node --test /tmp/proposed.test.js";
            };
            command.add(fixedScript);
            command.add("jarvis-fixed-script"); // shell $0
            command.add(kind == Kind.JAVA_COMPILE ? filename : "unused");
            return command;
        }

        private static void forceRemove(String name) {
            try {
                Process process = new ProcessBuilder("docker", "rm", "-f", name).start();
                if (!process.waitFor(3, TimeUnit.SECONDS)) process.destroyForcibly();
            } catch (IOException | InterruptedException e) {
                if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            }
        }
        private static void readBounded(InputStream from, ByteArrayOutputStream buffer) {
            byte[] chunk = new byte[1024];
            try {
                int n;
                while ((n = from.read(chunk)) != -1) {
                    synchronized (buffer) {
                        int copy = Math.min(n, MAX_OUTPUT_BYTES - buffer.size());
                        if (copy > 0) buffer.write(chunk, 0, copy);
                    }
                }
            } catch (IOException ignored) { /* process stopped */ }
        }
        private static String crop(ByteArrayOutputStream output) {
            synchronized (output) { return output.toString(StandardCharsets.UTF_8); }
        }
    }
}
