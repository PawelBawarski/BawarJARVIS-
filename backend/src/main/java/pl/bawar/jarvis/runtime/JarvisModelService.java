package pl.bawar.jarvis.runtime;

import pl.bawar.jarvis.brain.model.JarvisLanguageModel;
import pl.bawar.jarvis.brain.tokenizer.CharTokenizer;
import pl.bawar.jarvis.brain.training.EvaluationMetrics;
import pl.bawar.jarvis.brain.training.FullModelTrainer;
import pl.bawar.jarvis.brain.training.GenerationResult;
import pl.bawar.jarvis.brain.training.ModelCheckpoint;
import pl.bawar.jarvis.brain.training.ModelEvaluator;
import pl.bawar.jarvis.brain.training.TextGenerator;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Single owner of the mutable tiny LLM and its AdamW trainer.
 * Every operation touching the model is serialized under the same lock.
 * No HTTP endpoints are exposed by this class.
 */
public final class JarvisModelService {
    private static final int MAX_NEW_TOKENS = 64;
    private static final int MAX_EPOCHS = 100;
    private static final int MAX_EXAMPLES = 100;

    private final JarvisLanguageModel model;
    private final FullModelTrainer trainer;
    private final TextGenerator generator;
    private final ModelEvaluator evaluator;
    private final Path checkpointFile;
    private final ReentrantLock lock = new ReentrantLock(true);

    private long trainedExamplesThisSession;
    private boolean restoredFromCheckpoint;

    public JarvisModelService(JarvisLanguageModel model, Path checkpointFile,
                             double learningRate, double weightDecay,
                             double maxGradientNorm) {
        this.model = Objects.requireNonNull(model, "Model is required");
        this.checkpointFile = Objects.requireNonNull(checkpointFile, "Checkpoint path is required")
                .toAbsolutePath().normalize();
        this.trainer = new FullModelTrainer(model, learningRate, weightDecay, maxGradientNorm);
        this.generator = new TextGenerator(model);
        this.evaluator = new ModelEvaluator(trainer);
    }

    public GenerationResult generate(String prompt, int maxNewTokens,
                                     double temperature, long seed) {
        if (maxNewTokens < 0 || maxNewTokens > MAX_NEW_TOKENS) {
            throw new IllegalArgumentException("Maximum 64 new tokens per request");
        }
        lock.lock();
        try {
            return generator.generate(prompt, maxNewTokens, temperature, seed);
        } finally {
            lock.unlock();
        }
    }

    public EvaluationMetrics evaluate(List<String> examples) {
        lock.lock();
        try {
            validateExamples(examples);
            return evaluator.evaluate(examples);
        } finally {
            lock.unlock();
        }
    }

    /** A bounded, synchronous operation for manual testing. Later: a secured background job. */
    public TrainingSummary train(List<String> examples, int epochs) {
        if (epochs <= 0 || epochs > MAX_EPOCHS) {
            throw new IllegalArgumentException("Epoch count must be between 1 and 100");
        }
        lock.lock();
        try {
            // Validate ALL data before modifying any parameter.
            List<String> checked = validateExamples(examples);
            double lastLoss = Double.NaN;
            for (int epoch = 0; epoch < epochs; epoch++) {
                lastLoss = trainer.trainEpoch(checked);
                trainedExamplesThisSession += checked.size();
            }
            return new TrainingSummary(epochs, checked.size() * epochs, lastLoss);
        } finally {
            lock.unlock();
        }
    }

    public void saveCheckpoint() throws IOException {
        lock.lock();
        try {
            ModelCheckpoint.save(checkpointFile, trainer);
        } finally {
            lock.unlock();
        }
    }

    public void loadCheckpoint() throws IOException {
        lock.lock();
        try {
            if (!Files.isRegularFile(checkpointFile)) {
                throw new IOException("Checkpoint file does not exist: " + checkpointFile);
            }
            ModelCheckpoint.load(checkpointFile, trainer);
            restoredFromCheckpoint = true;
        } finally {
            lock.unlock();
        }
    }

    public ModelStatus status() {
        lock.lock();
        try {
            return new ModelStatus(
                    model.vocabularySize(), model.contextLength(),
                    trainedExamplesThisSession, Files.isRegularFile(checkpointFile),
                    restoredFromCheckpoint);
        } finally {
            lock.unlock();
        }
    }

    /** Intended for internal configuration/diagnostics, never as a client-supplied path. */
    public Path checkpointFile() {
        return checkpointFile;
    }

    private List<String> validateExamples(List<String> examples) {
        if (examples == null || examples.isEmpty() || examples.size() > MAX_EXAMPLES) {
            throw new IllegalArgumentException("Provide between 1 and 100 training examples");
        }
        for (String example : examples) {
            if (example == null || example.isBlank()) {
                throw new IllegalArgumentException("Training text cannot be null or blank");
            }
            int[] ids = model.tokenizer().encode(example);
            if (ids.length - 1 > model.contextLength()) {
                throw new IllegalArgumentException("Training example exceeds context window");
            }
            for (int id : ids) {
                if (id == CharTokenizer.UNK || id == CharTokenizer.PAD) {
                    throw new IllegalArgumentException("Training text contains unknown character");
                }
            }
        }
        return List.copyOf(examples);
    }
}
