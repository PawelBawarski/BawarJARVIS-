package pl.bawar.jarvis.agent;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.StandardCharsets;
import java.nio.charset.CodingErrorAction;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.attribute.PosixFilePermission;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/** Explicit, opt-in, single FULL file replacement. No commands or AI code are executed. */
@Service
public class AgentControlledFileService {
    private static final int MAX_BYTES = 16_384;
    private static final long TICKET_TTL_MILLIS = 5 * 60_000L;
    private final String workspaceConfig;
    private final boolean enabled;
    private final Path backupRoot;
    private final Map<String, Prepared> prepared = new ConcurrentHashMap<>();

    @Autowired
    public AgentControlledFileService(
            @Value("${JARVIS_AGENT_WORKSPACE_ROOT:}") String workspaceConfig,
            @Value("${JARVIS_AGENT_FILE_WRITES_ENABLED:false}") boolean enabled) {
        this(workspaceConfig, enabled, Path.of(System.getProperty("user.home"), ".jarvis", "agent-backups"));
    }

    // Package-private injection of isolated backup storage for tests.
    AgentControlledFileService(String workspaceConfig, boolean enabled, Path backupRoot) {
        this.workspaceConfig = workspaceConfig;
        this.enabled = enabled;
        this.backupRoot = backupRoot.toAbsolutePath().normalize();
    }

    public record Status(boolean enabled, String scope, String notice) { }
    public record PrepareRequest(String relativePath, String original, String proposed) { }
    public record PreparedResult(String ticket, String relativePath, String beforeSha256, String afterSha256,
                                 long expiresInSeconds, String notice) { }
    public record ApplyRequest(String ticket, String confirmation) { }
    public record RollbackRequest(String deploymentId, String confirmation) { }
    public record Result(String status, String deploymentId, String relativePath, String message) { }
    public record Deployment(String deploymentId, String relativePath, String status, String createdAt) { }
    private record Prepared(String relativePath, String original, String proposed, String originalHash,
                            String proposedHash, long expiresAt) { }

    public Status status() {
        if (!enabled || workspaceConfig == null || workspaceConfig.isBlank()) {
            return new Status(false, "", "Zapis jest wyłączony. Wymaga konfiguracji backendu.");
        }
        try {
            root();
            return new Status(true, workspaceConfig, "Zapis jednego istniejącego pliku, po dwóch potwierdzeniach.");
        } catch (IOException | IllegalArgumentException e) {
            return new Status(false, "", "Niepoprawny katalog projektu.");
        }
    }

    public synchronized PreparedResult prepare(PrepareRequest request) throws IOException {
        requireEnabled();
        if (request == null || request.original() == null || request.proposed() == null ||
            request.original().isBlank() || request.proposed().isBlank() ||
            request.original().equals(request.proposed())) {
            throw new IllegalArgumentException("EMPTY_OR_IDENTICAL_CHANGE");
        }
        byte[] expected = textBytes(request.original());
        textBytes(request.proposed());
        Path target = target(request.relativePath());
        if (!MessageDigest.isEqual(readSmall(target), expected)) throw new IllegalStateException("FILE_CHANGED");
        if (prepared.size() > 100) prepared.clear();
        String id = UUID.randomUUID().toString();
        String originalHash = sha256(expected);
        String proposedHash = sha256(textBytes(request.proposed()));
        prepared.put(id, new Prepared(request.relativePath(), request.original(), request.proposed(),
            originalHash, proposedHash, System.currentTimeMillis() + TICKET_TTL_MILLIS));
        return new PreparedResult(id, request.relativePath(), originalHash, proposedHash, 300,
            "Zatwierdź zapis osobnym przyciskiem. Nie wykonano jeszcze zmian.");
    }

    public synchronized Result apply(ApplyRequest request) throws IOException {
        requireEnabled();
        if (request == null || !"ZAPISZ".equals(request.confirmation()) || request.ticket() == null) {
            throw new IllegalArgumentException("CONFIRMATION_REQUIRED");
        }
        Prepared draft = prepared.remove(request.ticket()); // one-time authorization, never replay
        if (draft == null || System.currentTimeMillis() > draft.expiresAt()) {
            throw new IllegalStateException("TICKET_EXPIRED");
        }
        Path file = target(draft.relativePath());
        if (!sha256(readSmall(file)).equals(draft.originalHash())) throw new IllegalStateException("FILE_CHANGED");
        Path backupDir = safeBackupDir();
        String id = UUID.randomUUID().toString();
        Path copy = backupDir.resolve(id + ".orig");
        Path meta = backupDir.resolve(id + ".properties");
        byte[] original = readSmall(file);
        if (!sha256(original).equals(draft.originalHash())) throw new IllegalStateException("FILE_CHANGED");
        Files.write(copy, original);
        privateFile(copy);
        Properties p = new Properties();
        p.setProperty("relativePath", draft.relativePath());
        p.setProperty("beforeSha256", draft.originalHash());
        p.setProperty("afterSha256", draft.proposedHash());
        p.setProperty("workspaceSha256", sha256(root().toString().getBytes(StandardCharsets.UTF_8)));
        p.setProperty("createdAt", Instant.now().toString());
        try (var output = Files.newOutputStream(meta)) { p.store(output, "JARVIS local rollback record"); }
        privateFile(meta);
        // No silent fallback when atomic rename is unsupported; preserves backups on failure.
        replaceFile(file, textBytes(draft.proposed()), draft.originalHash());
        return new Result("applied", id, draft.relativePath(), "Zmianę zapisano. Kopia do cofnięcia jest zachowana.");
    }

    public synchronized Result rollback(RollbackRequest request) throws IOException {
        requireEnabled();
        if (request == null || !"COFNIJ".equals(request.confirmation())) {
            throw new IllegalArgumentException("CONFIRMATION_REQUIRED");
        }
        String id = checkedId(request.deploymentId());
        Properties p = readRecord(id);
        Path file = target(p.getProperty("relativePath"));
        byte[] backup = readSmall(safeBackupDir().resolve(id + ".orig"));
        if (!sha256(backup).equals(p.getProperty("beforeSha256"))) throw new IllegalStateException("BACKUP_CHANGED");
        if (!sha256(readSmall(file)).equals(p.getProperty("afterSha256"))) throw new IllegalStateException("FILE_CHANGED");
        replaceFile(file, backup, p.getProperty("afterSha256"));
        return new Result("rolled_back", id, p.getProperty("relativePath"), "Przywrócono poprzednią zawartość pliku.");
    }

    public synchronized List<Deployment> history() throws IOException {
        requireEnabled();
        Path directory = safeBackupDir();
        List<Deployment> found = new ArrayList<>();
        try (var files = Files.list(directory)) {
            for (Path meta : files.filter(p -> p.getFileName().toString().endsWith(".properties")).limit(100).toList()) {
                String id = meta.getFileName().toString().replace(".properties", "");
                try {
                    Properties p = readRecord(id);
                    Path file = target(p.getProperty("relativePath"));
                    String hash = sha256(readSmall(file));
                    String state = hash.equals(p.getProperty("afterSha256")) ? "applied" :
                        hash.equals(p.getProperty("beforeSha256")) ? "rolled_back" : "conflicted";
                    found.add(new Deployment(id, p.getProperty("relativePath"), state, p.getProperty("createdAt")));
                } catch (Exception ignored) { /* do not expose unreadable or stale records */ }
            }
        }
        found.sort((a,b) -> b.createdAt().compareTo(a.createdAt()));
        return found;
    }

    private void requireEnabled() {
        if (!enabled || workspaceConfig == null || workspaceConfig.isBlank()) {
            throw new IllegalStateException("FILE_WRITES_DISABLED");
        }
    }

    private Path root() throws IOException {
        requireEnabled();
        Path path = Path.of(workspaceConfig);
        if (!path.isAbsolute() || !Files.isDirectory(path, LinkOption.NOFOLLOW_LINKS) ||
            Files.isSymbolicLink(path)) throw new IllegalArgumentException("INVALID_WORKSPACE_ROOT");
        return path.toRealPath(LinkOption.NOFOLLOW_LINKS);
    }

    private Path target(String relativePath) throws IOException {
        if (!AgentSourceContext.validPath(relativePath)) throw new IllegalArgumentException("INVALID_FILE_PATH");
        Path base = root();
        Path target = base.resolve(relativePath.replace('/', java.io.File.separatorChar)).normalize();
        if (!target.startsWith(base) || !Files.isRegularFile(target, LinkOption.NOFOLLOW_LINKS)) {
            throw new IllegalArgumentException("INVALID_FILE_PATH");
        }
        Path cursor = base;
        for (Path segment : base.relativize(target)) {
            cursor = cursor.resolve(segment);
            if (Files.isSymbolicLink(cursor)) throw new IllegalArgumentException("SYMLINK_NOT_ALLOWED");
        }
        if (!target.toRealPath().startsWith(base)) throw new IllegalArgumentException("OUTSIDE_WORKSPACE");
        if (!Files.isWritable(target)) throw new IllegalArgumentException("FILE_NOT_WRITABLE");
        return target;
    }

    private byte[] readSmall(Path file) throws IOException {
        if (Files.size(file) > MAX_BYTES) throw new IllegalArgumentException("FILE_TOO_LARGE");
        byte[] bytes = Files.readAllBytes(file);
        try {
            StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes));
        } catch (CharacterCodingException ex) { throw new IllegalArgumentException("UTF8_REQUIRED"); }
        if (bytes.length > MAX_BYTES) throw new IllegalArgumentException("FILE_TOO_LARGE");
        return bytes;
    }

    private byte[] textBytes(String text) {
        if (text == null || text.indexOf('\0') >= 0 || text.getBytes(StandardCharsets.UTF_8).length > MAX_BYTES) {
            throw new IllegalArgumentException("INVALID_FILE_CONTENT");
        }
        return text.getBytes(StandardCharsets.UTF_8);
    }

    private Path safeBackupDir() throws IOException {
        Path workspace = root();
        if (backupRoot.startsWith(workspace) || Files.isSymbolicLink(backupRoot)) {
            throw new IllegalArgumentException("BACKUP_DIRECTORY_UNSAFE");
        }
        Files.createDirectories(backupRoot);
        // A symlinked parent could otherwise redirect a backup into the project.
        if (backupRoot.toRealPath().startsWith(workspace)) {
            throw new IllegalArgumentException("BACKUP_DIRECTORY_UNSAFE");
        }
        if (!Files.isDirectory(backupRoot, LinkOption.NOFOLLOW_LINKS) || Files.isSymbolicLink(backupRoot)) {
            throw new IllegalArgumentException("BACKUP_DIRECTORY_UNSAFE");
        }
        try { Files.setPosixFilePermissions(backupRoot, Set.of(PosixFilePermission.OWNER_READ,
            PosixFilePermission.OWNER_WRITE, PosixFilePermission.OWNER_EXECUTE)); }
        catch (UnsupportedOperationException ignored) { /* Windows ACLs are managed by OS/user */ }
        return backupRoot;
    }

    private Properties readRecord(String id) throws IOException {
        Path dir = safeBackupDir();
        Path meta = dir.resolve(checkedId(id) + ".properties");
        if (!Files.isRegularFile(meta, LinkOption.NOFOLLOW_LINKS) || Files.isSymbolicLink(meta)) {
            throw new IllegalArgumentException("UNKNOWN_DEPLOYMENT");
        }
        Properties p = new Properties();
        try (var input = Files.newInputStream(meta)) { p.load(input); }
        String expectedRoot = sha256(root().toString().getBytes(StandardCharsets.UTF_8));
        if (!expectedRoot.equals(p.getProperty("workspaceSha256"))) {
            throw new IllegalArgumentException("WRONG_WORKSPACE");
        }
        return p;
    }

    private String checkedId(String id) {
        try { return UUID.fromString(id).toString().equals(id) ? id : invalidId(); }
        catch (RuntimeException ex) { return invalidId(); }
    }
    private String invalidId() { throw new IllegalArgumentException("INVALID_DEPLOYMENT_ID"); }

    private void replaceFile(Path file, byte[] content, String expectedHash) throws IOException {
        // Serialize operations initiated by this service; external writers still require conflict review.
        if (!sha256(readSmall(file)).equals(expectedHash)) throw new IllegalStateException("FILE_CHANGED");
        Path temp = Files.createTempFile(file.getParent(), ".jarvis-", ".tmp");
        try {
            Files.write(temp, content);
            // Preserve POSIX read/write permissions rather than replacing a source with mode 600.
            try { Files.setPosixFilePermissions(temp, Files.getPosixFilePermissions(file)); }
            catch (UnsupportedOperationException ignored) { /* NTFS uses ACLs */ }
            Files.move(temp, file, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
        } finally { Files.deleteIfExists(temp); }
    }

    private String sha256(byte[] bytes) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)); }
        catch (NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }

    private void privateFile(Path file) throws IOException {
        try { Files.setPosixFilePermissions(file, Set.of(PosixFilePermission.OWNER_READ, PosixFilePermission.OWNER_WRITE)); }
        catch (UnsupportedOperationException ignored) { /* Windows ACLs are managed by OS/user */ }
    }
}
