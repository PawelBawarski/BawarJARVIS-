
package pl.bawar.jarvis.brain.layers;

import org.junit.jupiter.api.Test;

import pl.bawar.jarvis.brain.loss.CrossEntropyLoss;
import pl.bawar.jarvis.brain.loss.CrossEntropyGradient;

import static org.junit.jupiter.api.Assertions.*;

class DenseLayerBackwardTest {

    @Test
    void shouldCalculateAllGradients() {
        double[][] weights = {
                { 0.1, 0.2 },
                { 0.3, 0.4 }
        };

        DenseLayer layer = new DenseLayer(
                weights,
                new double[] { 0.0, 0.0 });

        DenseGradients result = layer.backward(
                new double[] { 2.0, -1.0 },
                new double[] { 0.25, -0.5 });

        assertArrayEquals(
                new double[] { -0.075, -0.125 },
                result.inputGradient(),
                1e-12);

        assertArrayEquals(
                new double[] { 0.5, -1.0 },
                result.weightGradients()[0],
                1e-12);

        assertArrayEquals(
                new double[] { -0.25, 0.5 },
                result.weightGradients()[1],
                1e-12);

        assertArrayEquals(
                new double[] { 0.25, -0.5 },
                result.biasGradients(),
                1e-12);
    }

    @Test
    void shouldMatchNumericalGradients() {
        double[][] weights = {
                { 0.2, -0.3, 0.4 },
                { 0.7, 0.5, -0.2 }
        };

        double[] biases = { 0.1, 0.0, -0.1 };
        double[] input = { 0.6, -1.2 };
        int target = 1;

        DenseLayer layer = new DenseLayer(weights, biases);

        double[] logits = layer.forward(input);

        double[] outputGradient = CrossEntropyGradient.calculate(logits, target);

        DenseGradients gradients = layer.backward(input, outputGradient);

        double epsilon = 1e-6;

        // Gradient checking macierzy wag.
        for (int i = 0; i < weights.length; i++) {
            for (int j = 0; j < weights[i].length; j++) {

                double[][] plus = copy(weights);
                double[][] minus = copy(weights);

                plus[i][j] += epsilon;
                minus[i][j] -= epsilon;

                double numerical = (loss(plus, biases, input, target)
                        - loss(minus, biases, input, target))
                        / (2.0 * epsilon);

                assertEquals(
                        numerical,
                        gradients.weightGradients()[i][j],
                        1e-6);
            }
        }

        // Gradient checking biasów.
        for (int j = 0; j < biases.length; j++) {
            double[] plus = biases.clone();
            double[] minus = biases.clone();

            plus[j] += epsilon;
            minus[j] -= epsilon;

            double numerical = (loss(weights, plus, input, target)
                    - loss(weights, minus, input, target))
                    / (2.0 * epsilon);

            assertEquals(
                    numerical,
                    gradients.biasGradients()[j],
                    1e-6);
        }

        // Gradient checking wejścia.
        for (int i = 0; i < input.length; i++) {
            double[] plus = input.clone();
            double[] minus = input.clone();

            plus[i] += epsilon;
            minus[i] -= epsilon;

            double numerical = (loss(weights, biases, plus, target)
                    - loss(weights, biases, minus, target))
                    / (2.0 * epsilon);

            assertEquals(
                    numerical,
                    gradients.inputGradient()[i],
                    1e-6);
        }
    }

    @Test
    void shouldRejectWrongGradientSize() {
        DenseLayer layer = new DenseLayer(
                new double[][] {
                        { 0.1, 0.2 },
                        { 0.3, 0.4 }
                },
                new double[] { 0.0, 0.0 });

        assertThrows(
                IllegalArgumentException.class,
                () -> layer.backward(
                        new double[] { 1.0, 2.0 },
                        new double[] { 0.5 }));
    }

    private static double loss(
            double[][] weights,
            double[] biases,
            double[] input,
            int target) {
        DenseLayer layer = new DenseLayer(weights, biases);

        return CrossEntropyLoss.calculate(
                layer.forward(input),
                target);
    }

    private static double[][] copy(double[][] source) {
        double[][] result = new double[source.length][];

        for (int i = 0; i < source.length; i++) {
            result[i] = source[i].clone();
        }

        return result;
    }
}
