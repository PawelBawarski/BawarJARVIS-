package pl.bawar.jarvis.brain.training;

import java.util.List;

/** Reuses the pure evaluation path from FullModelTrainer. */
public final class ModelEvaluator {
    private final FullModelTrainer trainer;
    public ModelEvaluator(FullModelTrainer trainer) {
        if (trainer == null) throw new IllegalArgumentException("Trainer required");
        this.trainer = trainer;
    }

    public EvaluationMetrics evaluate(List<String> examples) {
        if (examples == null || examples.isEmpty()) {
            throw new IllegalArgumentException("Evaluation corpus must not be empty");
        }
        double weightedLoss = 0;
        long tokens = 0;
        for (String example : examples) {
            // BOS -> ... -> EOS; number of predictions equals number of chars + EOS.
            int tokenCount = trainer.model().tokenizer().encode(example).length - 1;
            double loss = trainer.evaluateExample(example);
            weightedLoss += loss * tokenCount;
            tokens += tokenCount;
        }
        double mean = weightedLoss / tokens;
        return new EvaluationMetrics(mean, Math.exp(mean), tokens);
    }
}
