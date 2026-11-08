package pl.bawar.jarvis.brain.training;

import pl.bawar.jarvis.brain.optimization.AdamWState;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * Versioned, checked checkpoint for a pre-created model and its AdamW trainer.
 * No Java object deserialization. Includes full parameters, vocabulary identity and optimizer moments.
 * Call only while training/inference are stopped, under the application's model lock.
 */
public final class ModelCheckpoint {
    private static final String MAGIC = "JARVIS-LLM-CHECKPOINT";
    private static final int VERSION = 1;
    private static final int DIGEST_SIZE = 32; // SHA-256
    private static final int MAX_SIZE = 64 * 1024 * 1024; // educational model limit
    private ModelCheckpoint() { }

    public static void save(Path file, FullModelTrainer trainer) throws IOException {
        if (file == null || trainer == null) throw new IllegalArgumentException("File and trainer required");
        var model = trainer.model();
        List<ModelParameterRegistry.Slot> slots = ModelParameterRegistry.collect(model);
        Map<String, Integer> shapes = ModelParameterRegistry.optimizerShapes(slots);
        Map<String, AdamWState> states = new TreeMap<>(trainer.updater().snapshotStates());
        validateStates(states, shapes);

        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        try (DataOutputStream out = new DataOutputStream(buffer)) {
            out.writeUTF(MAGIC);
            out.writeInt(VERSION);
            out.writeDouble(trainer.updater().learningRate());
            out.writeDouble(trainer.updater().weightDecay());
            out.writeDouble(trainer.maxGradientNorm());
            out.writeInt(model.contextLength());
            out.writeInt(model.vocabularySize());
            int[] vocab = vocabulary(model);
            out.writeInt(vocab.length);
            for (int codePoint : vocab) out.writeInt(codePoint);

            out.writeInt(slots.size());
            for (ModelParameterRegistry.Slot slot : slots) {
                out.writeUTF(slot.name());
                writeTensor(out, slot.copy());
            }
            out.writeInt(states.size());
            for (var entry : states.entrySet()) {
                out.writeUTF(entry.getKey());
                AdamWState state = entry.getValue();
                out.writeLong(state.steps());
                double[] first = state.first(), second = state.second();
                out.writeInt(first.length);
                for (double x : first) out.writeDouble(x);
                for (double x : second) out.writeDouble(x);
            }
        }
        byte[] payload = buffer.toByteArray();
        if (payload.length + DIGEST_SIZE > MAX_SIZE) {
            throw new IOException("Checkpoint too large for educational format");
        }
        byte[] digest = sha256(payload);
        Path target = file.toAbsolutePath().normalize();
        Path directory = target.getParent();
        Files.createDirectories(directory);
        Path temporary = Files.createTempFile(directory, ".jarvis-checkpoint-", ".tmp");
        try {
            try (var output = Files.newOutputStream(temporary)) {
                output.write(payload);
                output.write(digest);
            }
            try {
                Files.move(temporary, target, StandardCopyOption.REPLACE_EXISTING,
                        StandardCopyOption.ATOMIC_MOVE);
            } catch (AtomicMoveNotSupportedException e) {
                // Same directory but atomic move not supported by filesystem.
                Files.move(temporary, target, StandardCopyOption.REPLACE_EXISTING);
            }
        } finally {
            Files.deleteIfExists(temporary);
        }
    }

    public static void load(Path file, FullModelTrainer trainer) throws IOException {
        if (file == null || trainer == null) throw new IllegalArgumentException("File and trainer required");
        if (Files.size(file) > MAX_SIZE || Files.size(file) <= DIGEST_SIZE) {
            throw new IOException("Invalid checkpoint size");
        }
        byte[] content = Files.readAllBytes(file);
        int payloadLength = content.length - DIGEST_SIZE;
        byte[] payload = Arrays.copyOf(content, payloadLength);
        byte[] checksum = Arrays.copyOfRange(content, payloadLength, content.length);
        if (!MessageDigest.isEqual(sha256(payload), checksum)) {
            throw new IOException("Checkpoint checksum mismatch");
        }
        var model = trainer.model();
        List<ModelParameterRegistry.Slot> slots = ModelParameterRegistry.collect(model);
        Map<String, Integer> shapes = ModelParameterRegistry.optimizerShapes(slots);
        List<double[][]> newTensors = new ArrayList<>(slots.size());
        Map<String, AdamWState> states = new HashMap<>();
        try (DataInputStream in = new DataInputStream(new ByteArrayInputStream(payload))) {
            if (!MAGIC.equals(in.readUTF()) || in.readInt() != VERSION) {
                throw new IOException("Unsupported checkpoint format");
            }
            if (Double.compare(in.readDouble(), trainer.updater().learningRate()) != 0
                    || Double.compare(in.readDouble(), trainer.updater().weightDecay()) != 0
                    || Double.compare(in.readDouble(), trainer.maxGradientNorm()) != 0) {
                throw new IOException("Trainer hyperparameters differ from checkpoint");
            }
            if (in.readInt() != model.contextLength() || in.readInt() != model.vocabularySize()) {
                throw new IOException("Incompatible model dimensions");
            }
            int[] vocab = vocabulary(model);
            if (in.readInt() != vocab.length) throw new IOException("Tokenizer vocabulary differs");
            for (int cp : vocab) {
                if (in.readInt() != cp) throw new IOException("Tokenizer vocabulary differs");
            }
            if (in.readInt() != slots.size()) throw new IOException("Model parameter layout differs");
            for (ModelParameterRegistry.Slot slot : slots) {
                if (!slot.name().equals(in.readUTF())) throw new IOException("Model tensor names differ");
                newTensors.add(readTensor(in, slot.copy()));
            }
            for (double value : newTensors.get(0)[0]) { // PAD must stay frozen
                if (value != 0) throw new IOException("Invalid PAD weights");
            }
            int stateCount = in.readInt();
            if (stateCount < 0 || stateCount > shapes.size()) {
                throw new IOException("Invalid number of optimizer states");
            }
            for (int i = 0; i < stateCount; i++) {
                String name = in.readUTF();
                Integer size = shapes.get(name);
                if (size == null) throw new IOException("Unknown optimizer state: " + name);
                long steps = in.readLong();
                if (in.readInt() != size) throw new IOException("Optimizer vector size mismatch");
                double[] first = new double[size], second = new double[size];
                for (int j = 0; j < size; j++) first[j] = in.readDouble();
                for (int j = 0; j < size; j++) second[j] = in.readDouble();
                AdamWState state = new AdamWState(steps, first, second);
                if (states.putIfAbsent(name, state) != null) {
                    throw new IOException("Duplicate optimizer state: " + name);
                }
            }
            if (in.available() != 0) throw new IOException("Unexpected trailing checkpoint data");
        } catch (IllegalArgumentException e) {
            throw new IOException("Invalid checkpoint values", e);
        }
        // All fields validated, including optimizer state, before touching model weights.
        validateStates(states, shapes);
        for (int i = 0; i < slots.size(); i++) slots.get(i).replace(newTensors.get(i));
        trainer.updater().restoreStates(states);
    }

    private static void writeTensor(DataOutputStream out, double[][] values) throws IOException {
        out.writeInt(values.length);
        for (double[] row : values) {
            out.writeInt(row.length);
            for (double value : row) {
                if (!Double.isFinite(value)) throw new IOException("Non-finite model parameter");
                out.writeDouble(value);
            }
        }
    }

    /** No dynamic allocation based on on-disk tensor dimensions. */
    private static double[][] readTensor(DataInputStream in, double[][] expected) throws IOException {
        if (in.readInt() != expected.length) throw new IOException("Tensor height mismatch");
        double[][] result = new double[expected.length][];
        for (int i = 0; i < expected.length; i++) {
            if (in.readInt() != expected[i].length) throw new IOException("Tensor width mismatch");
            result[i] = new double[expected[i].length];
            for (int j = 0; j < result[i].length; j++) {
                double value = in.readDouble();
                if (!Double.isFinite(value)) throw new IOException("Non-finite checkpoint tensor value");
                result[i][j] = value;
            }
        }
        return result;
    }

    private static void validateStates(Map<String, AdamWState> states, Map<String, Integer> shapes)
            throws IOException {
        for (var entry : states.entrySet()) {
            Integer size = shapes.get(entry.getKey());
            if (size == null || entry.getValue() == null || entry.getValue().size() != size) {
                throw new IOException("Optimizer state does not match model: " + entry.getKey());
            }
        }
    }

    private static int[] vocabulary(pl.bawar.jarvis.brain.model.JarvisLanguageModel model) {
        int count = model.vocabularySize() - 4;
        int[] codePoints = new int[count];
        for (int id = 4; id < model.vocabularySize(); id++) {
            String symbol = model.tokenizer().decode(new int[]{id});
            int[] cps = symbol.codePoints().toArray();
            if (cps.length != 1) throw new IllegalStateException("Expected a character tokenizer");
            codePoints[id - 4] = cps[0];
        }
        return codePoints;
    }

    private static byte[] sha256(byte[] content) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(content);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("JDK missing SHA-256", e);
        }
    }
}
