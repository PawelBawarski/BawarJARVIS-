package pl.bawar.jarvis.lab.history;

import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Service;
import pl.bawar.jarvis.brain.training.EvaluationMetrics;

import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

/** Persists real LLM metrics. Raw training/evaluation text is never stored. */
@Service
public class LabHistoryService {
    private final LabHistoryRepository repo;
    // This tracks ONLY the exact saved/loaded checkpoint whose weights are currently active.
    private volatile UUID activeCheckpointId;

    public LabHistoryService(LabHistoryRepository repo) { this.repo = repo; }

    @PostConstruct
    public void recoverInterruptedJobs() { repo.markInterrupted(); }

    public void started(String id, int epochs, int examples) {
        activeCheckpointId = null; // Model weights will change; old evaluation association becomes invalid.
        repo.started(UUID.fromString(id), epochs, examples);
    }
    public void epoch(String id, int number, int examples, double loss) {
        if (!Double.isFinite(loss) || loss < 0) throw new IllegalArgumentException("Invalid loss");
        repo.epoch(UUID.fromString(id), number, examples, loss);
    }
    public void completed(String id) { repo.completed(UUID.fromString(id)); }
    public void failed(String id) { repo.failed(UUID.fromString(id)); }

    /** Copy the current checkpoint to a unique immutable snapshot. No renderer-controlled paths. */
    public synchronized void checkpointSaved(Path activeFile, String completedRunId) throws IOException {
        Path source = activeFile.toAbsolutePath().normalize();
        if (!Files.isRegularFile(source, LinkOption.NOFOLLOW_LINKS))
            throw new IOException("Active checkpoint missing or unsafe");
        Path directory = source.getParent().resolve("snapshots");
        Files.createDirectories(directory);
        if (Files.isSymbolicLink(directory)) throw new IOException("Unsafe snapshots directory");
        UUID id = UUID.randomUUID();
        Path target = directory.resolve("jarvis-" + id + ".ckpt");
        try {
            Files.copy(source, target); // CREATE_NEW behavior: never replace a previous version.
            String hash = sha256(target);
            long bytes = Files.size(target);
            UUID runId = completedRunId == null ? null : UUID.fromString(completedRunId);
            try {
                repo.checkpoint(id, runId, "jarvis-tiny-v1", target.toString(), bytes, hash);
            } catch (RuntimeException e) {
                Files.deleteIfExists(target);
                throw e;
            }
            activeCheckpointId = id;
        } catch (IOException e) {
            Files.deleteIfExists(target);
            throw e;
        }
    }

    public synchronized void checkpointLoaded(Path activeFile) throws IOException {
        Path source = activeFile.toAbsolutePath().normalize();
        activeCheckpointId = Files.isRegularFile(source, LinkOption.NOFOLLOW_LINKS)
                ? repo.latestMatchingCheckpoint(sha256(source)) : null;
    }

    public void evaluated(EvaluationMetrics metrics, List<String> examples) {
        if (!Double.isFinite(metrics.meanCrossEntropy()) || metrics.meanCrossEntropy() < 0 ||
            !Double.isFinite(metrics.perplexity()) || metrics.perplexity() < 1 ||
            examples == null || examples.isEmpty()) {
            throw new IllegalArgumentException("Invalid evaluation");
        }
        repo.evaluation(UUID.randomUUID(), activeCheckpointId, metrics.meanCrossEntropy(),
                metrics.perplexity(), examples.size(), corpusDigest(examples));
    }

    public List<LabHistoryRepository.Run> runs() { return repo.runs(); }
    public List<LabHistoryRepository.Epoch> epochs(UUID id) { return repo.epochs(id); }
    public List<LabHistoryRepository.Checkpoint> checkpoints() { return repo.checkpoints(); }
    public List<LabHistoryRepository.Evaluation> evaluations() { return repo.evaluations(); }

    /** Length-prefix every sample so ["ab", "c"] and ["a", "bc"] don't collide. */
    static String corpusDigest(List<String> examples) {
        MessageDigest digest = digest();
        for (String example : examples) {
            byte[] data = example.getBytes(StandardCharsets.UTF_8);
            digest.update(ByteBuffer.allocate(4).putInt(data.length).array());
            digest.update(data);
        }
        return HexFormat.of().formatHex(digest.digest());
    }
    private static MessageDigest digest() {
        try { return MessageDigest.getInstance("SHA-256"); }
        catch (NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
    private static String sha256(Path file) throws IOException {
        MessageDigest digest = digest();
        try (InputStream in = Files.newInputStream(file)) {
            byte[] buffer = new byte[8192];
            for (int n; (n = in.read(buffer)) != -1;) digest.update(buffer, 0, n);
        }
        return HexFormat.of().formatHex(digest.digest());
    }
}
