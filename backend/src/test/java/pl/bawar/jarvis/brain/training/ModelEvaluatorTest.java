package pl.bawar.jarvis.brain.training;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class ModelEvaluatorTest {
    @Test
    void shouldComputeWeightedLossAndPerplexity() {
        var model = TinyTestModels.create("abab", 42);
        var trainer = new FullModelTrainer(model, 0.005, 0.0, 1.0);
        double lossAb = trainer.evaluateExample("ab"); // 3 target tokens
        double lossA = trainer.evaluateExample("a");   // 2 target tokens
        EvaluationMetrics metrics = new ModelEvaluator(trainer).evaluate(List.of("ab", "a"));
        assertEquals(5, (int) metrics.targetTokens());
        assertEquals((3 * lossAb + 2 * lossA) / 5, metrics.meanCrossEntropy(), 1e-12);
        assertEquals(Math.exp(metrics.meanCrossEntropy()), metrics.perplexity(), 1e-12);
    }

    @Test
    void evaluationMustNotChangeParametersOrOptimizer() {
        var model = TinyTestModels.create("abab", 44);
        var trainer = new FullModelTrainer(model, 0.005, 0.0, 1.0);
        var before = model.languageModelHead().weightsCopy();
        var first = new ModelEvaluator(trainer).evaluate(List.of("abab", "ba"));
        var second = new ModelEvaluator(trainer).evaluate(List.of("abab", "ba"));
        assertEquals(first, second);
        var after = model.languageModelHead().weightsCopy();
        for (int i = 0; i < before.length; i++) assertArrayEquals(before[i], after[i], 0);
    }

    @Test
    void shouldRejectEmptyDataset() {
        var trainer = new FullModelTrainer(TinyTestModels.create("abab", 44), 0.005, 0.0, 1.0);
        assertThrows(IllegalArgumentException.class, () -> new ModelEvaluator(trainer).evaluate(List.of()));
        assertThrows(IllegalArgumentException.class, () -> new ModelEvaluator(trainer).evaluate(List.of("z")));
    }
}
