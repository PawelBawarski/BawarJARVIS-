package pl.bawar.jarvis.brain.optimization;

import org.junit.jupiter.api.Test;
import pl.bawar.jarvis.brain.layers.DenseGradients;
import pl.bawar.jarvis.brain.layers.DenseLayer;
import pl.bawar.jarvis.brain.loss.CrossEntropyGradient;
import pl.bawar.jarvis.brain.loss.CrossEntropyLoss;

import static org.junit.jupiter.api.Assertions.assertTrue;

class AdamWDenseTrainingTest {

    @Test
    void shouldReduceLossByUpdatingRealDenseWeights() {
        double[][] weights = {
                {0.05, -0.10},
                {0.02, 0.03}
        };
        double[] biases = {0.0, 0.0};
        double[] input = {1.0, -1.0};
        int targetIndex = 0;
        double learningRate = 0.05;

        // Osobna historia momentów dla każdego wiersza W i dla biasów.
        AdamWOptimizer[] weightOptimizers = new AdamWOptimizer[weights.length];
        for (int row = 0; row < weights.length; row++) {
            weightOptimizers[row] = new AdamWOptimizer(
                    weights[row].length, learningRate, 0.01);
        }
        AdamWOptimizer biasOptimizer = new AdamWOptimizer(
                biases.length, learningRate, 0.0);

        double before = CrossEntropyLoss.calculate(
                new DenseLayer(weights, biases).forward(input), targetIndex);

        for (int epoch = 0; epoch < 80; epoch++) {
            // DenseLayer kopiuje parametry, dlatego odtwarzamy ją z aktualnych wag.
            DenseLayer layer = new DenseLayer(weights, biases);
            double[] logits = layer.forward(input);
            double[] dLogits = CrossEntropyGradient.calculate(logits, targetIndex);
            DenseGradients gradients = layer.backward(input, dLogits);

            for (int row = 0; row < weights.length; row++) {
                weightOptimizers[row].step(
                        weights[row], gradients.weightGradients()[row]);
            }
            biasOptimizer.step(biases, gradients.biasGradients());
        }

        double after = CrossEntropyLoss.calculate(
                new DenseLayer(weights, biases).forward(input), targetIndex);

        assertTrue(after < before, "Training should reduce the loss");
        assertTrue(after < 0.1, "Loss should be small after 80 steps");
    }
}
