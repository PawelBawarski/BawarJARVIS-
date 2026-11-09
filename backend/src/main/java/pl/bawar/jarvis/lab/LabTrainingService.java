package pl.bawar.jarvis.lab;

import jakarta.annotation.PreDestroy;
import org.springframework.stereotype.Service;
import pl.bawar.jarvis.runtime.JarvisModelService;
import pl.bawar.jarvis.lab.history.LabHistoryService;
import org.springframework.beans.factory.annotation.Autowired;
import pl.bawar.jarvis.runtime.ModelStatus;
import pl.bawar.jarvis.brain.training.EvaluationMetrics;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** One bounded background training job for one mutable local model. No user-supplied file paths. */
@Service
public final class LabTrainingService {
    private final JarvisModelService model;
    private final ExecutorService executor = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "jarvis-ai-lab-trainer");
        t.setDaemon(true);
        return t;
    });
    private volatile TrainingState current = TrainingState.idle();
    private volatile LabHistoryService history;
    private boolean busy;

    public LabTrainingService(JarvisModelService model) {
        this.model = model;
    }

    @Autowired(required = false)
    public void attachHistory(LabHistoryService history) { this.history = history; }

    public record TrainingState(String id, String status, int epoch, int totalEpochs,
                                List<Double> losses, String error) {
        public static TrainingState idle() {
            return new TrainingState(null, "IDLE", 0, 0, List.of(), null);
        }
    }

    public synchronized TrainingState start(List<String> examples, int epochs) {
        if (busy) throw new IllegalStateException("Training is already running");
        validate(examples, epochs);
        List<String> corpus = List.copyOf(examples);
        String id = UUID.randomUUID().toString();
        if (history != null) history.started(id, epochs, corpus.size());
        busy = true;
        current = new TrainingState(id, "RUNNING", 0, epochs, List.of(), null);
        try {
            executor.execute(() -> train(id, corpus, epochs));
        } catch (RuntimeException e) {
            if (history != null) history.failed(id);
            busy = false;
            current = TrainingState.idle();
            throw e;
        }
        return current;
    }

    private void train(String id, List<String> corpus, int epochs) {
        List<Double> losses = new ArrayList<>();
        try {
            for (int epoch = 1; epoch <= epochs; epoch++) {
                double loss = model.train(corpus, 1).lastEpochLoss();
                if (!Double.isFinite(loss)) throw new IllegalStateException("Non-finite loss");
                losses.add(loss);
                if (history != null) history.epoch(id, epoch, corpus.size(), loss);
                current = new TrainingState(id, "RUNNING", epoch, epochs, List.copyOf(losses), null);
            }
            if (history != null) history.completed(id);
            current = new TrainingState(id, "COMPLETED", epochs, epochs, List.copyOf(losses), null);
        } catch (Exception ex) {
            if (history != null) {
                try { history.failed(id); } catch (RuntimeException ignored) { /* Database may be unavailable */ }
            }
            // Deliberately do not echo user-provided corpus, model paths or stack traces to frontend.
            current = new TrainingState(id, "FAILED", losses.size(), epochs,
                    List.copyOf(losses), "TRAINING_FAILED_CHECK_BACKEND_LOGS");
        } finally {
            synchronized (this) { busy = false; }
        }
    }

    public TrainingState progress() { return current; }

    public ModelStatus modelStatus() { return model.status(); }

    public synchronized void save() throws IOException {
        if (busy) throw new IllegalStateException("Training is running");
        model.saveCheckpoint();
        if (history != null) history.checkpointSaved(model.checkpointFile(),
                "COMPLETED".equals(current.status()) ? current.id() : null);
    }

    public synchronized void load() throws IOException {
        if (busy) throw new IllegalStateException("Training is running");
        model.loadCheckpoint();
        if (history != null) history.checkpointLoaded(model.checkpointFile());
        current = TrainingState.idle();
    }

    public synchronized EvaluationMetrics evaluate(List<String> examples) {
        if (busy) throw new IllegalStateException("Training is running");
        if (examples == null || examples.isEmpty() || examples.size() > 100) {
            throw new IllegalArgumentException("Provide between 1 and 100 examples");
        }
        List<String> checked = List.copyOf(examples);
        EvaluationMetrics result = model.evaluate(checked);
        if (history != null) history.evaluated(result, checked);
        return result;
    }

    private static void validate(List<String> examples, int epochs) {
        if (epochs < 1 || epochs > 100) throw new IllegalArgumentException("Epochs: 1..100");
        if (examples == null || examples.isEmpty() || examples.size() > 100) {
            throw new IllegalArgumentException("Examples: 1..100");
        }
        for (String example : examples) {
            if (example == null || example.isBlank() || example.length() > 256) {
                throw new IllegalArgumentException("Invalid training example (max 256 chars)");
            }
        }
    }

    @PreDestroy public void shutdown() { executor.shutdownNow(); }
}
