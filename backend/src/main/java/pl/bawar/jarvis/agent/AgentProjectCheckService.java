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

/** 19.4: Test a user-selected, version-bound source snapshot; never read the host workspace. */
public final class AgentProjectCheckService {
    static final int MAX_FILES = 500;
    static final int MAX_FILE_BYTES = 524_288;
    static final int MAX_TOTAL_BYTES = 4_194_304;
    static final int MAX_OUTPUT_BYTES = 24_000;
    static final int TIMEOUT_SECONDS = 180;
    private final boolean enabled;
    private final Execution execution;
    private final Semaphore running = new Semaphore(1);

    public record Source(String path, String content) { }
    public record Request(String projectKind, String relativePath, String original, String proposed, List<Source> files) { }
    public record Result(String checkId, String kind, String status, String summary, String relativePath,
                         String proposedSha256, String snapshotSha256, String image, int fileCount,
                         String output, long elapsedMs) { }
    record Outcome(String status, String output) { }
    record Snapshot(String kind, String path, String proposedSha256, String snapshotSha256,
                    String image, int fileCount, byte[] zip) { }
    interface Execution { Outcome run(Snapshot snapshot) throws IOException, InterruptedException; }

    public AgentProjectCheckService(boolean enabled) { this(enabled, new DockerExecution()); }
    AgentProjectCheckService(boolean enabled, Execution execution) { this.enabled = enabled; this.execution = execution; }

    public Result check(Request request) {
        if (!enabled) throw new IllegalStateException("PROJECT_CHECK_DISABLED");
        Snapshot snapshot = snapshot(request);
        if (!running.tryAcquire()) throw new IllegalStateException("PROJECT_CHECK_BUSY");
        long started = System.nanoTime();
        try {
            Outcome outcome = execution.run(snapshot);
            return result(snapshot, outcome.status(), outcome.output(), started);
        } catch (IOException ex) {
            return result(snapshot, "unavailable", "Docker lub przygotowany obraz z zależnościami jest niedostępny.", started);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            return result(snapshot, "unavailable", "Weryfikacja została przerwana.", started);
        } finally { running.release(); }
    }

    private Result result(Snapshot s, String status, String output, long started) {
        String summary = switch (status) {
            case "passed" -> "PASS — testy przesłanej kopii projektu (bez dostępu do repozytorium hosta)";
            case "failed" -> "FAIL — testy nie przeszły; sprawdź logi";
            case "timeout" -> "TIMEOUT — przekroczono limit 180 sekund";
            default -> "UNAVAILABLE — brak obrazu offline, Dockera lub środowiska testowego";
        };
        return new Result(UUID.randomUUID().toString(), s.kind(), status, summary, s.path(),
            s.proposedSha256(), s.snapshotSha256(), s.image(), s.fileCount(),
            output.length() > MAX_OUTPUT_BYTES ? output.substring(0, MAX_OUTPUT_BYTES) : output,
            Duration.ofNanos(System.nanoTime() - started).toMillis());
    }

    static Snapshot snapshot(Request request) {
        if (request == null || !Set.of("angular", "spring").contains(request.projectKind()) ||
            request.files() == null || request.files().isEmpty() || request.files().size() > MAX_FILES ||
            request.original() == null || request.proposed() == null || request.original().equals(request.proposed()))
            throw new IllegalArgumentException("INVALID_PROJECT_CHECK");
        boolean angular = request.projectKind().equals("angular");
        String path = normalizePreviewPath(request.relativePath(), angular);
        if (!allowed(path, angular) || !path.startsWith("src/"))
            throw new IllegalArgumentException("INVALID_PROJECT_TARGET");
        LinkedHashMap<String, byte[]> files = new LinkedHashMap<>();
        Set<String> names = new HashSet<>();
        int total = 0;
        for (Source item : request.files()) {
            if (item == null || !allowed(item.path(), angular) || item.content() == null ||
                !names.add(item.path().toLowerCase(Locale.ROOT)))
                throw new IllegalArgumentException("INVALID_PROJECT_FILE");
            byte[] bytes = utf8(item.content());
            total += bytes.length;
            if (total > MAX_TOTAL_BYTES) throw new IllegalArgumentException("PROJECT_TOO_LARGE");
            files.put(item.path(), bytes);
        }
        byte[] current = files.get(path);
        if (current == null || !MessageDigest.isEqual(current, utf8(request.original())))
            throw new IllegalArgumentException("PROJECT_SOURCE_MISMATCH");
        files.put(path, utf8(request.proposed()));
        if (total - current.length + utf8(request.proposed()).length > MAX_TOTAL_BYTES)
            throw new IllegalArgumentException("PROJECT_TOO_LARGE");
        byte[] manifest = files.get(angular ? "package.json" : "pom.xml");
        if (manifest == null) throw new IllegalArgumentException("PROJECT_MANIFEST_MISSING");
        byte[] lock = angular ? files.get("package-lock.json") : null;
        if (angular && (lock == null || !files.containsKey("angular.json") ||
                !files.containsKey("tsconfig.json")))
            throw new IllegalArgumentException("PROJECT_MANIFEST_MISSING");
        String dependencyHash = angular ? sha256(manifest, new byte[]{0}, lock) : sha256(manifest);
        String image = "jarvis-" + (angular ? "angular" : "spring") + "-test:19-4-" + dependencyHash.substring(0, 12);
        return new Snapshot(request.projectKind(), path, sha256(utf8(request.proposed())),
            fingerprint(files), image, files.size(), archive(files));
    }

    static String normalizePreviewPath(String value, boolean angular) {
        if (value == null) throw new IllegalArgumentException("INVALID_PROJECT_TARGET");
        String prefix = angular ? "frontend/" : "backend/";
        return value.startsWith(prefix) ? value.substring(prefix.length()) : value;
    }

    static boolean allowed(String path, boolean angular) {
        if (path == null || path.length() > 200 || path.contains("\\") || path.startsWith("/") ||
            !path.matches("[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)*")) return false;
        for (String segment : path.split("/")) {
            if (segment.equals(".") || segment.equals("..") || segment.startsWith(".")) return false;
        }
        if (angular) {
            if (Set.of("package.json", "package-lock.json", "angular.json", "tsconfig.json",
                "tsconfig.app.json", "tsconfig.spec.json", "tsconfig.base.json").contains(path)) return true;
            if (path.startsWith("src/") && path.matches(".*\\.(ts|tsx|html|scss|css|json)")) return true;
            return path.startsWith("public/i18n/") && path.endsWith(".json");
        }
        if (path.equals("pom.xml")) return true;
        if (path.startsWith("src/main/java/") || path.startsWith("src/test/java/")) return path.endsWith(".java");
        if (path.startsWith("src/main/resources/db/migration/")) return path.endsWith(".sql");
        return (path.startsWith("src/main/resources/") || path.startsWith("src/test/resources/")) &&
            path.matches(".*\\.(xml|yml|yaml|properties|json|sql)");
    }

    private static byte[] utf8(String value) {
        if (value.indexOf('\0') >= 0) throw new IllegalArgumentException("INVALID_PROJECT_CONTENT");
        byte[] bytes = value.getBytes(StandardCharsets.UTF_8);
        if (bytes.length > MAX_FILE_BYTES) throw new IllegalArgumentException("PROJECT_FILE_TOO_LARGE");
        return bytes;
    }
    private static byte[] archive(Map<String, byte[]> files) {
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            try (ZipOutputStream zip = new ZipOutputStream(out)) {
                for (var item : files.entrySet()) {
                    ZipEntry entry = new ZipEntry(item.getKey()); entry.setTime(0);
                    zip.putNextEntry(entry); zip.write(item.getValue()); zip.closeEntry();
                }
            }
            return out.toByteArray();
        } catch (IOException e) { throw new IllegalStateException("PROJECT_ARCHIVE_FAILED", e); }
    }
    private static String fingerprint(Map<String, byte[]> files) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            files.entrySet().stream().sorted(Map.Entry.comparingByKey()).forEach(item -> {
                digest.update(item.getKey().getBytes(StandardCharsets.UTF_8)); digest.update((byte) 0);
                digest.update(item.getValue()); digest.update((byte) 0);
            });
            return HexFormat.of().formatHex(digest.digest());
        } catch (NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
    private static String sha256(byte[]... blocks) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            for (byte[] block : blocks) digest.update(block);
            return HexFormat.of().formatHex(digest.digest());
        } catch (NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }

    static final class DockerExecution implements Execution {
        @Override public Outcome run(Snapshot snapshot) throws IOException, InterruptedException {
            String name = "jarvis-project-" + UUID.randomUUID().toString().replace("-", "");
            Process proc = new ProcessBuilder(command(snapshot, name)).redirectErrorStream(true).start();
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            Thread drain = Thread.startVirtualThread(() -> readOutput(proc.getInputStream(), output));
            boolean completed = false;
            try {
                Thread.startVirtualThread(() -> {
                    try (var stream = proc.getOutputStream()) { stream.write(snapshot.zip()); }
                    catch (IOException ignored) { }
                });
                completed = proc.waitFor(TIMEOUT_SECONDS, TimeUnit.SECONDS);
                if (!completed) {
                    proc.destroyForcibly(); drain.join(1000);
                    return new Outcome("timeout", crop(output));
                }
                drain.join(1000);
                int exit = proc.exitValue();
                return new Outcome(exit == 0 ? "passed" : exit == 125 ? "unavailable" : "failed", crop(output));
            } finally {
                if (proc.isAlive()) proc.destroyForcibly();
                if (!completed) forceRemove(name);
            }
        }
        static List<String> command(Snapshot snapshot, String name) {
            List<String> args = new ArrayList<>(List.of("docker", "run", "--rm", "-i", "--pull=never",
                "--name", name, "--network", "none", "--read-only", "--cap-drop=ALL",
                "--security-opt", "no-new-privileges", "--pids-limit", "128", "--cpus", "2",
                "--memory", "2g", "--memory-swap", "2g", "--user", "65534:65534",
                "--env", "HOME=/tmp", "--env", "CI=true", "--env", "NG_CLI_ANALYTICS=false",
                "--env", "npm_config_offline=true", "--tmpfs", "/tmp:rw,nosuid,nodev,size=1024m,mode=1777",
                "--workdir", "/tmp", "--entrypoint", "/bin/sh", snapshot.image(), "-c"));
            String command = snapshot.kind().equals("angular")
                ? "set -eu; mkdir -p /tmp/work; unzip -q /tmp/snapshot.zip -d /tmp/work; cd /tmp/work; " +
                  "ln -s /opt/jarvis/node_modules node_modules; " +
                  "node /opt/jarvis/node_modules/@angular/cli/bin/ng.js test --watch=false"
                : "set -eu; mkdir -p /tmp/work; cd /tmp/work; jar xf /tmp/snapshot.zip; " +
                  "mvn -B -ntp -o -Dmaven.repo.local=/opt/m2 test";
            // Source travels exclusively on stdin, never via command arguments or a host mount.
            args.add("set -eu; cat > /tmp/snapshot.zip; " + command);
            return args;
        }
        private static void readOutput(InputStream input, ByteArrayOutputStream sink) {
            try {
                byte[] chunk = new byte[2048]; int n;
                while ((n = input.read(chunk)) != -1) {
                    synchronized (sink) { int take = Math.min(n, MAX_OUTPUT_BYTES - sink.size());
                        if (take > 0) sink.write(chunk, 0, take); }
                }
            } catch (IOException ignored) { }
        }
        private static String crop(ByteArrayOutputStream sink) {
            synchronized (sink) { return sink.toString(StandardCharsets.UTF_8); }
        }
        private static void forceRemove(String name) {
            try {
                Process stop = new ProcessBuilder("docker", "rm", "-f", name).start();
                if (!stop.waitFor(3, TimeUnit.SECONDS)) stop.destroyForcibly();
            } catch (IOException | InterruptedException ex) {
                if (ex instanceof InterruptedException) Thread.currentThread().interrupt();
            }
        }
    }
}
