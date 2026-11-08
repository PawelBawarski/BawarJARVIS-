package pl.bawar.jarvis.brain.layers;

import org.junit.jupiter.api.Test;
import pl.bawar.jarvis.brain.loss.CrossEntropyGradient;
import pl.bawar.jarvis.brain.loss.CrossEntropyLoss;
import pl.bawar.jarvis.brain.optimization.AdamWOptimizer;

import static org.junit.jupiter.api.Assertions.assertTrue;

class FeedForwardNetworkAdamWTrainingTest {

    @Test
    void shouldReduceCrossEntropyByUpdatingBothDenseLayers() {
        // Jeden przyklad szkoleniowy. Wagi trzymamy poza DenseLayer,
        // poniewaz DenseLayer kopiuje tablice w konstruktorze.
        double[][] w1 = {{0.2, -0.3, 0.4}, {0.7, 0.5, -0.2}};
        double[] b1 = {0.1, -0.1, 0.05};
        double[][] w2 = {{0.1, -0.4}, {0.3, 0.2}, {-0.2, 0.6}};
        double[] b2 = {0.05, -0.05};

        AdamWOptimizer[] w1Opt = createOptimizers(w1.length, w1[0].length);
        AdamWOptimizer[] w2Opt = createOptimizers(w2.length, w2[0].length);
        AdamWOptimizer b1Opt = new AdamWOptimizer(b1.length, 0.03, 0.0);
        AdamWOptimizer b2Opt = new AdamWOptimizer(b2.length, 0.03, 0.0);

        double[] input = {0.6, -1.2};
        int correctToken = 1;
        double initialLoss = loss(w1, b1, w2, b2, input, correctToken);

        for (int step = 0; step < 100; step++) {
            // W kazdej iteracji budujemy FFN z NOWYCH wag.
            FeedForwardNetwork ffn = new FeedForwardNetwork(
                    new DenseLayer(w1, b1), new DenseLayer(w2, b2));
            double[] logits = ffn.forward(input);
            double[] dLogits = CrossEntropyGradient.calculate(logits, correctToken);
            FeedForwardGradients g = ffn.backward(input, dLogits);

            DenseGradients first = g.inputLayerGradients();
            DenseGradients second = g.outputLayerGradients();
            for (int i = 0; i < w1.length; i++) {
                w1Opt[i].step(w1[i], first.weightGradients()[i]);
            }
            b1Opt.step(b1, first.biasGradients());
            for (int i = 0; i < w2.length; i++) {
                w2Opt[i].step(w2[i], second.weightGradients()[i]);
            }
            b2Opt.step(b2, second.biasGradients());
        }

        double finalLoss = loss(w1, b1, w2, b2, input, correctToken);
        assertTrue(finalLoss < initialLoss,
                "AdamW should lower loss: before=" + initialLoss + " after=" + finalLoss);
    }

    private static AdamWOptimizer[] createOptimizers(int rows, int cols) {
        AdamWOptimizer[] optimizers = new AdamWOptimizer[rows];
        for (int i = 0; i < rows; i++) optimizers[i] = new AdamWOptimizer(cols, 0.03, 0.0);
        return optimizers;
    }

    private static double loss(double[][] w1, double[] b1,
                               double[][] w2, double[] b2,
                               double[] x, int target) {
        FeedForwardNetwork net = new FeedForwardNetwork(
                new DenseLayer(w1, b1), new DenseLayer(w2, b2));
        return CrossEntropyLoss.calculate(net.forward(x), target);
    }
}
