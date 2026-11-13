package pl.bawar.jarvis.agent;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/** 19.3: explicit, bounded in-memory module snapshot. Does not read or mount the host workspace. */
public final class AgentModuleCheckService {
    static final int MAX_EXTRA_FILES = 8;
    static final int MAX_FILE_BYTES = 32_768;
    static final int MAX_TOTAL_BYTES = 131_072;
    static final int MAX_OUTPUT_BYTES = 12_000;
    static final int TIMEOUT_SECONDS = 30;
    private final boolean enabled;
    private final Execution execution;
    private final Semaphore running = new Semaphore(1);

    public record Source(String name, String content) { }
    public record CheckRequest(String relativePath, String original, String proposed,
                               List<Source> relatedFiles, String testFile) { }
    public record CheckResult(String checkId, String relativePath, String proposedSha256,
                              String snapshotSha256, String kind, String status, String summary,
                              int fileCount, String output, long elapsedMs) { }
    record Outcome(String status, String output) { }
    record Snapshot(String path, String kind, String testFile, byte[] zip,
                    String proposedSha256, String snapshotSha256, int fileCount) { }
    interface Execution { Outcome run(Snapshot snapshot) throws IOException, InterruptedException; }

    public AgentModuleCheckService(boolean enabled) { this(enabled, new DockerExecution()); }
    AgentModuleCheckService(boolean enabled, Execution execution) {
        this.enabled = enabled;
        this.execution = execution;
    }

    public CheckResult check(CheckRequest request) {
        if (!enabled) throw new IllegalStateException("MODULE_CHECK_DISABLED");
        Snapshot snapshot = snapshot(request);
        if (!running.tryAcquire()) throw new IllegalStateException("MODULE_CHECK_BUSY");
        long started = System.nanoTime();
        try {
            Outcome outcome = execution.run(snapshot);
            return result(snapshot, outcome.status(), outcome.output(), started);
        } catch (IOException ex) {
            return result(snapshot, "unavailable", "Docker lub obraz wykonawczy jest niedostępny.", started);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            return result(snapshot, "unavailable", "Kontrola została przerwana.", started);
        } finally { running.release(); }
    }

    private CheckResult result(Snapshot s, String status, String output, long started) {
        return new CheckResult(UUID.randomUUID().toString(), s.path(), s.proposedSha256(),
            s.snapshotSha256(), s.kind(), status,
            switch (status) {
                case "passed" -> "PASS — ograniczona kontrola wybranych plików, bez zależności npm/Maven";
                case "failed" -> "FAIL — sprawdź diagnostykę; nie zmieniono projektu";
                case "timeout" -> "Kontrola przekroczyła limit czasu";
                default -> "Kontrola niedostępna — sprawdź Docker Desktop i obrazy";
            }, s.fileCount(), output.length() > MAX_OUTPUT_BYTES ? output.substring(0, MAX_OUTPUT_BYTES) : output,
            Duration.ofNanos(System.nanoTime() - started).toMillis());
    }

    static Snapshot snapshot(CheckRequest r) {
        if (r == null || !AgentSourceContext.validPath(r.relativePath()) ||
            r.original() == null || r.original().isBlank() ||
            r.proposed() == null || r.proposed().isBlank() ||
            r.original().equals(r.proposed())) throw new IllegalArgumentException("INVALID_MODULE_PREVIEW");
        List<Source> extras = r.relatedFiles() == null ? List.of() : r.relatedFiles();
        if (extras.size() > MAX_EXTRA_FILES) throw new IllegalArgumentException("TOO_MANY_MODULE_FILES");

        String path = r.relativePath();
        String dir = path.contains("/") ? path.substring(0, path.lastIndexOf('/') + 1) : "";
        String ext = extension(path);
        String kind = switch (ext) {
            case "java" -> "JAVA_MODULE";
            case "ts" -> "TS_SYNTAX_MODULE";
            case "js", "cjs" -> "JS_MODULE";
            default -> throw new IllegalArgumentException("UNSUPPORTED_MODULE_KIND");
        };
        LinkedHashMap<String, byte[]> files = new LinkedHashMap<>();
        byte[] proposed = contentBytes(r.proposed());
        byte[] original = contentBytes(r.original());
        if (original.length > MAX_FILE_BYTES) throw new IllegalArgumentException("MODULE_FILE_TOO_LARGE");
        files.put(path, proposed);
        Set<String> normalizedNames = new HashSet<>();
        normalizedNames.add(path.toLowerCase(Locale.ROOT));
        int total = proposed.length;
        for (Source source : extras) {
            if (source == null || source.name() == null || source.name().contains("/") ||
                source.name().contains("\\") || !AgentSourceContext.validPath(dir + source.name()) ||
                source.content() == null) throw new IllegalArgumentException("INVALID_MODULE_FILE");
            String next = dir + source.name();
            if (!normalizedNames.add(next.toLowerCase(Locale.ROOT)))
                throw new IllegalArgumentException("DUPLICATE_MODULE_FILE");
            String extraExt = extension(next);
            if (kind.equals("JAVA_MODULE") != extraExt.equals("java") ||
                kind.equals("TS_SYNTAX_MODULE") != extraExt.equals("ts") ||
                kind.equals("JS_MODULE") && !Set.of("js", "cjs").contains(extraExt))
                throw new IllegalArgumentException("INCOMPATIBLE_MODULE_FILE");
            byte[] data = contentBytes(source.content());
            total += data.length;
            if (total > MAX_TOTAL_BYTES) throw new IllegalArgumentException("MODULE_SNAPSHOT_TOO_LARGE");
            files.put(next, data);
        }
        if (total > MAX_TOTAL_BYTES) throw new IllegalArgumentException("MODULE_SNAPSHOT_TOO_LARGE");
        String test = "";
        if (kind.equals("JS_MODULE")) {
            if (r.testFile() != null && !r.testFile().isBlank()) {
                if (r.testFile().contains("/") || r.testFile().contains("\\") ||
                    !r.testFile().matches("[A-Za-z0-9_-][A-Za-z0-9._-]{0,79}\\.(test|spec)\\.(js|cjs)"))
                    throw new IllegalArgumentException("INVALID_MODULE_TEST");
                test = dir + r.testFile();
                if (!files.containsKey(test)) throw new IllegalArgumentException("MISSING_MODULE_TEST");
            }
            kind = test.isBlank() ? "JS_SYNTAX_MODULE" : "JS_TEST_MODULE";
        } else if (r.testFile() != null && !r.testFile().isBlank()) {
            throw new IllegalArgumentException("MODULE_TEST_NOT_SUPPORTED");
        }
        byte[] archive = archive(files);
        String fingerprint = fingerprint(files);
        return new Snapshot(path, kind, test, archive, sha256(proposed), fingerprint, files.size());
    }

    private static String extension(String path) {
        int dot = path.lastIndexOf('.');
        return dot == -1 ? "" : path.substring(dot + 1).toLowerCase(Locale.ROOT);
    }
    private static byte[] contentBytes(String content) {
        if (content.indexOf('\0') >= 0) throw new IllegalArgumentException("INVALID_MODULE_CONTENT");
        byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
        if (bytes.length > MAX_FILE_BYTES) throw new IllegalArgumentException("MODULE_FILE_TOO_LARGE");
        return bytes;
    }
    private static byte[] archive(Map<String, byte[]> files) {
        try {
            ByteArrayOutputStream sink = new ByteArrayOutputStream();
            try (ZipOutputStream zip = new ZipOutputStream(sink)) {
                for (var entry : files.entrySet()) {
                    ZipEntry item = new ZipEntry(entry.getKey());
                    item.setTime(0L);
                    zip.putNextEntry(item);
                    zip.write(entry.getValue());
                    zip.closeEntry();
                }
            }
            return sink.toByteArray();
        } catch (IOException e) { throw new IllegalStateException("MODULE_ARCHIVE_FAILED", e); }
    }
    private static String fingerprint(Map<String, byte[]> files) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            files.entrySet().stream().sorted(Map.Entry.comparingByKey()).forEach(entry -> {
                md.update(entry.getKey().getBytes(StandardCharsets.UTF_8));
                md.update((byte)0);
                md.update(entry.getValue());
                md.update((byte)0);
            });
            return HexFormat.of().formatHex(md.digest());
        } catch (NoSuchAlgorithmException ex) { throw new IllegalStateException(ex); }
    }
    private static String sha256(byte[] bytes) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)); }
        catch (NoSuchAlgorithmException ex) { throw new IllegalStateException(ex); }
    }

    /** No host bind mounts, source never appears in the shell command or container arguments. */
    static final class DockerExecution implements Execution {
        @Override public Outcome run(Snapshot snapshot) throws IOException, InterruptedException {
            String name = "jarvis-module-" + UUID.randomUUID().toString().replace("-", "");
            Process proc = new ProcessBuilder(command(snapshot, name)).redirectErrorStream(true).start();
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            Thread drain = Thread.startVirtualThread(() -> readBounded(proc.getInputStream(), output));
            boolean completed = false;
            try {
                Thread.startVirtualThread(() -> {
                    try (var in = proc.getOutputStream()) { in.write(snapshot.zip()); }
                    catch (IOException ignored) { /* docker stopped */ }
                });
                completed = proc.waitFor(TIMEOUT_SECONDS, TimeUnit.SECONDS);
                if (!completed) {
                    proc.destroyForcibly();
                    drain.join(1000);
                    return new Outcome("timeout", crop(output));
                }
                drain.join(1000);
                return new Outcome(proc.exitValue() == 0 ? "passed" : proc.exitValue() == 125 ? "unavailable" : "failed", crop(output));
            } finally {
                if (proc.isAlive()) proc.destroyForcibly();
                if (!completed) forceRemove(name);
            }
        }

        static List<String> command(Snapshot snapshot, String name) {
            String image = snapshot.kind().equals("JAVA_MODULE") ? "eclipse-temurin:21-jdk-alpine" : "node:22-alpine";
            List<String> args = new ArrayList<>(List.of("docker", "run", "--rm", "-i", "--pull=never", "--name", name,
                "--network", "none", "--read-only", "--cap-drop=ALL", "--security-opt", "no-new-privileges",
                "--pids-limit", "64", "--cpus", "1", "--memory", "384m", "--memory-swap", "384m",
                "--user", "65534:65534", "--tmpfs", "/tmp:rw,nosuid,nodev,noexec,size=64m,mode=1777",
                "--workdir", "/tmp", "--entrypoint", "/bin/sh", image, "-c"));
            String script = "set -eu; mkdir -p /tmp/work /tmp/out; cat > /tmp/snapshot.zip; " +
                "unzip -q /tmp/snapshot.zip -d /tmp/work; cd /tmp/work; " +
                "case \"$1\" in " +
                "JAVA_MODULE) find . -type f -name '*.java' -exec javac -proc:none -encoding UTF-8 -d /tmp/out {} + ;; " +
                "TS_SYNTAX_MODULE) find . -type f -name '*.ts' -exec node --disable-warning=ExperimentalWarning -e 'const fs=require(\"node:fs\"); const mod=require(\"node:module\"); for(const f of process.argv.slice(1)) mod.stripTypeScriptTypes(fs.readFileSync(f,\"utf8\"));' {} + ;; " +
                "JS_SYNTAX_MODULE) find . -type f \\( -name '*.js' -o -name '*.cjs' \\) -exec sh -c 'for f do node --check \"$f\" || exit 1; done' sh {} + ;; " +
                "JS_TEST_MODULE) node --test \"./$2\" ;; " +
                "*) exit 78 ;; esac";
            args.add(script);
            args.add("jarvis-module-script");
            args.add(snapshot.kind());
            args.add(snapshot.testFile());
            return args;
        }
        private static void forceRemove(String name) {
            try {
                Process process = new ProcessBuilder("docker", "rm", "-f", name).start();
                if (!process.waitFor(3, TimeUnit.SECONDS)) process.destroyForcibly();
            } catch (IOException | InterruptedException ex) {
                if (ex instanceof InterruptedException) Thread.currentThread().interrupt();
            }
        }
        private static void readBounded(InputStream stream, ByteArrayOutputStream buffer) {
            try {
                byte[] chunk = new byte[1024]; int count;
                while ((count = stream.read(chunk)) >= 0) {
                    synchronized (buffer) {
                        int n = Math.min(count, MAX_OUTPUT_BYTES - buffer.size());
                        if (n > 0) buffer.write(chunk, 0, n);
                    }
                }
            } catch (IOException ignored) { }
        }
        private static String crop(ByteArrayOutputStream bytes) {
            synchronized (bytes) { return bytes.toString(StandardCharsets.UTF_8); }
        }
    }
}
