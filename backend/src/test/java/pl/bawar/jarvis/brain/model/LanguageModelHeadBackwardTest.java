package pl.bawar.jarvis.brain.model;

import org.junit.jupiter.api.Test;
import pl.bawar.jarvis.brain.layers.DenseLayer;
import static org.junit.jupiter.api.Assertions.*;

class LanguageModelHeadBackwardTest {
    @Test
    void shouldSumWeightAndBiasGradientsOverTokens() {
        DenseLayer head = new DenseLayer(new double[][]{{0.2, -0.3}, {0.4, 0.1}},
                new double[]{0, 0});
        LanguageModelHeadGradients d = LanguageModelHeadBackward.calculate(head,
                new double[][]{{1, 2}, {3, 4}},
                new double[][]{{0.5, -0.5}, {0.25, -0.25}});
        assertArrayEquals(new double[]{1.25, -1.25}, d.weightGradients()[0], 1e-12);
        assertArrayEquals(new double[]{2.0, -2.0}, d.weightGradients()[1], 1e-12);
        assertArrayEquals(new double[]{0.75, -0.75}, d.biasGradients(), 1e-12);
    }

    @Test
    void shouldMatchFiniteDifferencesForWeightsAndInputs() {
        double[][] weights = {{0.2, -0.3}, {0.4, 0.1}};
        double[] biases = {0.15, -0.1};
        double[][] hidden = {{1, 2}, {-1, 3}};
        double[][] upstream = {{0.5, -0.5}, {0.25, -0.25}};
        DenseLayer head = new DenseLayer(weights, biases);
        LanguageModelHeadGradients grad = LanguageModelHeadBackward.calculate(head, hidden, upstream);
        double epsilon = 1e-6;
        for (int i = 0; i < 2; i++) for (int j = 0; j < 2; j++) {
            double[][] plus = copy(weights); plus[i][j] += epsilon;
            double[][] minus = copy(weights); minus[i][j] -= epsilon;
            double numerical = (objective(plus, biases, hidden, upstream)
                    - objective(minus, biases, hidden, upstream)) / (2 * epsilon);
            assertEquals(numerical, grad.weightGradients()[i][j], 1e-8);
        }
        for (int j = 0; j < 2; j++) {
            double[] plus = biases.clone(); plus[j] += epsilon;
            double[] minus = biases.clone(); minus[j] -= epsilon;
            double numerical = (objective(weights, plus, hidden, upstream)
                    - objective(weights, minus, hidden, upstream)) / (2 * epsilon);
            assertEquals(numerical, grad.biasGradients()[j], 1e-8);
        }
        for (int t = 0; t < hidden.length; t++) for (int j = 0; j < 2; j++) {
            double[][] plus = copy(hidden); plus[t][j] += epsilon;
            double[][] minus = copy(hidden); minus[t][j] -= epsilon;
            double numerical = (objective(weights, biases, plus, upstream)
                    - objective(weights, biases, minus, upstream)) / (2 * epsilon);
            assertEquals(numerical, grad.inputGradients()[t][j], 1e-8);
        }
    }

    private static double objective(double[][] w, double[] b, double[][] x, double[][] dOut) {
        DenseLayer layer = new DenseLayer(w, b);
        double sum = 0;
        for (int t = 0; t < x.length; t++) {
            double[] y = layer.forward(x[t]);
            for (int j = 0; j < y.length; j++) sum += y[j] * dOut[t][j];
        }
        return sum;
    }
    private static double[][] copy(double[][] matrix) {
        double[][] c = new double[matrix.length][];
        for (int i = 0; i < matrix.length; i++) c[i] = matrix[i].clone();
        return c;
    }
}
