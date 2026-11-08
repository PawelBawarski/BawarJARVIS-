package pl.bawar.jarvis.brain.training;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class ModelCheckpointTest {
    @Test
    void shouldRestoreWeightsAndAdamWMomentsForExactContinuedTraining() throws Exception {
        var original = TinyTestModels.create("abab", 42);
        var trainer = new FullModelTrainer(original, 0.005, 0.01, 1.0);
        trainer.trainExample("abab");
        trainer.trainExample("ab");

        Path checkpoint = Files.createTempFile("jarvis-llm-", ".ckpt");
        try {
            ModelCheckpoint.save(checkpoint, trainer);
            var recovered = TinyTestModels.create("abab", 987);
            var secondTrainer = new FullModelTrainer(recovered, 0.005, 0.01, 1.0);
            ModelCheckpoint.load(checkpoint, secondTrainer);
            assertArrayEquals(original.nextTokenProbabilities("ab"),
                    recovered.nextTokenProbabilities("ab"), 0.0);
            assertEquals(trainer.evaluateExample("abab"), secondTrainer.evaluateExample("abab"), 0.0);
            // The following step also depends on saved first/second AdamW moments.
            trainer.trainExample("abab");
            secondTrainer.trainExample("abab");
            assertArrayEquals(original.nextTokenProbabilities("ab"),
                    recovered.nextTokenProbabilities("ab"), 0.0);
        } finally {
            Files.deleteIfExists(checkpoint);
        }
    }

    @Test
    void shouldRejectCorruptFileWithoutChangingParameters() throws Exception {
        var source = TinyTestModels.create("abab", 5);
        var trainer = new FullModelTrainer(source, 0.005, 0.0, 1.0);
        trainer.trainExample("abab");
        Path file = Files.createTempFile("jarvis-llm-corrupt-", ".ckpt");
        try {
            ModelCheckpoint.save(file, trainer);
            byte[] bytes = Files.readAllBytes(file);
            bytes[bytes.length / 2] ^= 0x20;
            Files.write(file, bytes);
            double[] before = source.nextTokenProbabilities("ab");
            assertThrows(IOException.class, () -> ModelCheckpoint.load(file, trainer));
            assertArrayEquals(before, source.nextTokenProbabilities("ab"), 0.0);
        } finally {
            Files.deleteIfExists(file);
        }
    }

    @Test
    void shouldRejectDifferentVocabularyEvenWithSameSize() throws Exception {
        var source = TinyTestModels.create("abab", 5);
        var trainer = new FullModelTrainer(source, 0.005, 0.0, 1.0);
        Path file = Files.createTempFile("jarvis-llm-vocab-", ".ckpt");
        try {
            ModelCheckpoint.save(file, trainer);
            var other = TinyTestModels.create("cdcd", 5);
            var otherTrainer = new FullModelTrainer(other, 0.005, 0.0, 1.0);
            assertThrows(IOException.class, () -> ModelCheckpoint.load(file, otherTrainer));
        } finally {
            Files.deleteIfExists(file);
        }
    }

    @Test
    void shouldRejectDifferentLearningRate() throws Exception {
        var source = TinyTestModels.create("abab", 5);
        Path file = Files.createTempFile("jarvis-llm-lr-", ".ckpt");
        try {
            ModelCheckpoint.save(file, new FullModelTrainer(source, 0.005, 0.0, 1.0));
            assertThrows(IOException.class, () -> ModelCheckpoint.load(file,
                    new FullModelTrainer(TinyTestModels.create("abab", 5), 0.001, 0.0, 1.0)));
        } finally {
            Files.deleteIfExists(file);
        }
    }
}
