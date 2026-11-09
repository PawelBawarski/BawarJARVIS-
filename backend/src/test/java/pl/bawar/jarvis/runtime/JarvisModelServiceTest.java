package pl.bawar.jarvis.runtime;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import pl.bawar.jarvis.brain.model.TinyGptFactory;

import java.io.IOException;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

class JarvisModelServiceTest {
    @TempDir Path temporaryDirectory;

    private JarvisModelService service(long seed, Path checkpoint) {
        return new JarvisModelService(
                TinyGptFactory.create("abc ", seed), checkpoint,
                0.005, 0.0, 1.0);
    }

    @Test
    void shouldGenerateWithBoundedTokenCount() {
        var jarvis = service(42L, temporaryDirectory.resolve("model.ckpt"));
        var result = jarvis.generate("ab", 3, 0.0, 17L);
        assertTrue(result.text().startsWith("ab"));
        assertTrue(result.generatedTokens() <= 3);
        assertEquals(128, jarvis.status().contextLength());
    }

    @Test
    void shouldTrainWithSameModelInstance() {
        var jarvis = service(42L, temporaryDirectory.resolve("model.ckpt"));
        var summary = jarvis.train(List.of("aba", "cab"), 2);
        assertEquals(2, summary.epochs());
        assertEquals(4, summary.examplesProcessed());
        assertEquals(4, jarvis.status().trainedExamplesThisSession());
        assertTrue(Double.isFinite(summary.lastEpochLoss()));
    }

    @Test
    void shouldRejectBadCorpusBeforeAnyTraining() {
        var jarvis = service(42L, temporaryDirectory.resolve("model.ckpt"));
        assertThrows(IllegalArgumentException.class,
                () -> jarvis.train(List.of("aba", "🧪"), 1));
        assertEquals(0, jarvis.status().trainedExamplesThisSession());
        assertThrows(IllegalArgumentException.class,
                () -> jarvis.train(List.of("aba"), 101));
    }

    @Test
    void shouldSaveAndRestoreResults() throws IOException {
        Path checkpoint = temporaryDirectory.resolve("nested").resolve("model.ckpt");
        var first = service(42L, checkpoint);
        first.train(List.of("aba", "cab"), 2);
        double loss = first.evaluate(List.of("aba")).meanCrossEntropy();
        first.saveCheckpoint();
        assertTrue(first.status().checkpointAvailable());

        var restored = service(555L, checkpoint);
        restored.loadCheckpoint();
        assertTrue(restored.status().restoredFromCheckpoint());
        assertEquals(loss, restored.evaluate(List.of("aba")).meanCrossEntropy(), 0.0);
        assertEquals(first.generate("ab", 4, 0.0, 17),
                restored.generate("ab", 4, 0.0, 17));
    }

    @Test
    void shouldFailClosedWhenCheckpointMissing() {
        var jarvis = service(42L, temporaryDirectory.resolve("missing.ckpt"));
        assertThrows(IOException.class, jarvis::loadCheckpoint);
        assertFalse(jarvis.status().restoredFromCheckpoint());
    }

    @Test
    void shouldSerializeTrainingAndGeneration() throws Exception {
        var jarvis = service(42L, temporaryDirectory.resolve("model.ckpt"));
        try (var pool = Executors.newFixedThreadPool(2)) {
            var training = pool.submit(() -> jarvis.train(List.of("aba"), 4));
            var generating = pool.submit(() -> jarvis.generate("ab", 2, 0, 5L));
            assertEquals(4, training.get(30, TimeUnit.SECONDS).examplesProcessed());
            assertTrue(generating.get(30, TimeUnit.SECONDS).text().startsWith("ab"));
        }
    }
}
