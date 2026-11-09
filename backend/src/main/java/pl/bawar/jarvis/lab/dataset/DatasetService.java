package pl.bawar.jarvis.lab.dataset;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/** Bounded, immutable corpus versions. No filesystem access or network retrieval. */
@Service
public class DatasetService {
    private final DatasetRepository repository;

    public DatasetService(DatasetRepository repository) { this.repository = repository; }

    public record Partition(List<String> training, List<String> validation,
                            String fullSha256, String validationSha256) { }

    public static String validateName(String value) {
        if (value == null) throw new IllegalArgumentException("Dataset name is required");
        String name = value.strip();
        if (name.isEmpty() || name.length() > 80 || name.chars().anyMatch(Character::isISOControl))
            throw new IllegalArgumentException("Dataset name must contain 1..80 printable characters");
        return name;
    }

    /** A version requires at least five distinct examples for a nonempty hold-out set. */
    public static Partition partition(List<String> examples) {
        if (examples == null || examples.size() < 5 || examples.size() > 100)
            throw new IllegalArgumentException("Expected 5..100 examples");
        List<String> normalized = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (String example : examples) {
            if (example == null) throw new IllegalArgumentException("Null example");
            String value = example.strip();
            if (value.isEmpty() || value.length() > 256 || value.chars().anyMatch(Character::isISOControl))
                throw new IllegalArgumentException("Each example must contain 1..256 printable characters");
            if (!seen.add(value)) throw new IllegalArgumentException("Duplicate examples are not allowed");
            normalized.add(value);
        }
        // Order independent split. Adding/removing an example creates a new immutable version.
        normalized.sort(Comparator.comparing(x -> sha256Text("jarvis-split-v1:" + x)));
        int validationSize = Math.max(1, (int) Math.ceil(normalized.size() * .20));
        int trainSize = normalized.size() - validationSize;
        List<String> training = List.copyOf(normalized.subList(0, trainSize));
        List<String> validation = List.copyOf(normalized.subList(trainSize, normalized.size()));
        return new Partition(training, validation, corpusSha256(normalized), corpusSha256(validation));
    }

    @Transactional
    public DatasetRepository.Version create(String name, List<String> examples) {
        String checkedName = validateName(name);
        Partition partition = partition(examples);
        UUID id = UUID.randomUUID();
        repository.createDataset(id, checkedName);
        return repository.insertVersion(UUID.randomUUID(), id, 1, partition);
    }

    @Transactional
    public DatasetRepository.Version newVersion(UUID datasetId, List<String> examples) {
        Objects.requireNonNull(datasetId, "Dataset ID is required");
        Partition partition = partition(examples);
        // SELECT FOR UPDATE serializes version increments for the same dataset.
        int number = repository.lockAndNextVersion(datasetId);
        return repository.insertVersion(UUID.randomUUID(), datasetId, number, partition);
    }

    @Transactional(readOnly = true)
    public List<DatasetRepository.Summary> listDatasets() { return repository.listDatasets(); }

    @Transactional(readOnly = true)
    public List<DatasetRepository.Version> versions(UUID datasetId) {
        Objects.requireNonNull(datasetId);
        return repository.versions(datasetId);
    }

    @Transactional(readOnly = true)
    public DatasetRepository.Samples readVersion(UUID versionId) {
        Objects.requireNonNull(versionId);
        return repository.readVersion(versionId);
    }

    static String corpusSha256(List<String> examples) {
        MessageDigest digest = digest();
        for (String example : examples) {
            byte[] utf8 = example.getBytes(StandardCharsets.UTF_8);
            digest.update(ByteBuffer.allocate(4).putInt(utf8.length).array());
            digest.update(utf8);
        }
        return HexFormat.of().formatHex(digest.digest());
    }

    private static String sha256Text(String text) {
        return HexFormat.of().formatHex(digest().digest(text.getBytes(StandardCharsets.UTF_8)));
    }

    private static MessageDigest digest() {
        try { return MessageDigest.getInstance("SHA-256"); }
        catch (NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
}
