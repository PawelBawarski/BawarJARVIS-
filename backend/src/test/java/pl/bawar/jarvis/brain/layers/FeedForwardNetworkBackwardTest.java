package pl.bawar.jarvis.brain.layers;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class FeedForwardNetworkBackwardTest {
    private static final double EPS = 1e-6;
    private static final double TOL = 2e-6;

    private static final double[][] W1 = {
            {0.2, -0.3, 0.4},
            {0.7,  0.5, -0.2}
    };
    private static final double[] B1 = {0.1, -0.1, 0.05};
    private static final double[][] W2 = {
            {0.1, -0.4},
            {0.3,  0.2},
            {-0.2, 0.6}
    };
    private static final double[] B2 = {0.05, -0.05};

    private static FeedForwardNetwork create(
            double[][] w1, double[] b1, double[][] w2, double[] b2) {
        return new FeedForwardNetwork(
                new DenseLayer(w1, b1), new DenseLayer(w2, b2));
    }

    private static double[] single(double[][] w1, double[] b1,
                                   double[][] w2, double[] b2,
                                   double[] x) {
        return create(w1, b1, w2, b2).forward(x);
    }

    private static double objective(double[][] w1, double[] b1,
                                    double[][] w2, double[] b2,
                                    double[][] xs, double[][] upstream) {
        double result = 0.0;
        FeedForwardNetwork net = create(w1, b1, w2, b2);
        for (int t = 0; t < xs.length; t++) {
            double[] y = net.forward(xs[t]);
            for (int j = 0; j < y.length; j++) {
                result += y[j] * upstream[t][j];
            }
        }
        return result;
    }

    @Test
    void shouldPropagateGradientWithCorrectDimensions() {
        FeedForwardGradients g = create(W1, B1, W2, B2).backward(
                new double[]{0.6, -1.2}, new double[]{0.7, -0.4});

        assertEquals(2, g.inputGradient().length);
        assertEquals(2, g.inputLayerGradients().weightGradients().length);
        assertEquals(3, g.inputLayerGradients().weightGradients()[0].length);
        assertEquals(3, g.inputLayerGradients().biasGradients().length);
        assertEquals(3, g.outputLayerGradients().weightGradients().length);
        assertEquals(2, g.outputLayerGradients().weightGradients()[0].length);
        assertEquals(2, g.outputLayerGradients().biasGradients().length);
    }

    @Test
    void shouldMatchNumericalGradientForInputAndBothLayers() {
        double[] x = {0.6, -1.2};
        double[] dy = {0.7, -0.4};
        FeedForwardGradients grad = create(W1, B1, W2, B2).backward(x, dy);
        double[][] xs = {x};
        double[][] dys = {dy};

        // dL/dx
        for (int i = 0; i < x.length; i++) {
            double[] plus = x.clone();
            double[] minus = x.clone();
            plus[i] += EPS;
            minus[i] -= EPS;
            double numeric = (objective(W1, B1, W2, B2, new double[][]{plus}, dys)
                    - objective(W1, B1, W2, B2, new double[][]{minus}, dys)) / (2 * EPS);
            assertEquals(numeric, grad.inputGradient()[i], TOL);
        }

        assertParameterGradients(xs, dys,
                grad.inputLayerGradients().weightGradients(),
                grad.inputLayerGradients().biasGradients(),
                grad.outputLayerGradients().weightGradients(),
                grad.outputLayerGradients().biasGradients());
    }

    @Test
    void shouldAccumulateSharedParameterGradientsAcrossTokens() {
        double[][] xs = {{0.6, -1.2}, {-0.3, 0.8}, {0.4, 0.1}};
        double[][] dys = {{0.7, -0.4}, {-0.5, 0.2}, {0.1, -0.3}};
        FeedForwardNetwork ffn = create(W1, B1, W2, B2);

        FeedForwardBatchGradients batch = ffn.backward(xs, dys);
        assertEquals(xs.length, batch.inputGradients().length);

        double[][] summedW1 = new double[2][3];
        double[] summedB1 = new double[3];
        double[][] summedW2 = new double[3][2];
        double[] summedB2 = new double[2];

        for (int t = 0; t < xs.length; t++) {
            FeedForwardGradients one = ffn.backward(xs[t], dys[t]);
            assertArrayEquals(one.inputGradient(), batch.inputGradients()[t], 1e-12);
            accumulate(summedW1, one.inputLayerGradients().weightGradients());
            accumulate(summedB1, one.inputLayerGradients().biasGradients());
            accumulate(summedW2, one.outputLayerGradients().weightGradients());
            accumulate(summedB2, one.outputLayerGradients().biasGradients());
        }

        for (int i = 0; i < 2; i++) assertArrayEquals(summedW1[i], batch.inputWeightGradients()[i], 1e-12);
        for (int i = 0; i < 3; i++) assertArrayEquals(summedW2[i], batch.outputWeightGradients()[i], 1e-12);
        assertArrayEquals(summedB1, batch.inputBiasGradients(), 1e-12);
        assertArrayEquals(summedB2, batch.outputBiasGradients(), 1e-12);
    }

    @Test
    void shouldMatchNumericalParameterGradientsForEntireBatch() {
        double[][] xs = {{0.6, -1.2}, {-0.3, 0.8}};
        double[][] dys = {{0.7, -0.4}, {-0.5, 0.2}};
        FeedForwardBatchGradients batch = create(W1, B1, W2, B2).backward(xs, dys);

        assertParameterGradients(xs, dys,
                batch.inputWeightGradients(), batch.inputBiasGradients(),
                batch.outputWeightGradients(), batch.outputBiasGradients());
    }

    @Test
    void shouldRejectInvalidDimensionsAndNonFiniteNumbers() {
        FeedForwardNetwork ffn = create(W1, B1, W2, B2);
        assertThrows(IllegalArgumentException.class, () -> ffn.backward(new double[]{1}, new double[]{1, 2}));
        assertThrows(IllegalArgumentException.class, () -> ffn.backward(new double[]{1, 2}, new double[]{1}));
        assertThrows(IllegalArgumentException.class, () -> ffn.backward(new double[]{1, Double.NaN}, new double[]{1, 2}));
        assertThrows(IllegalArgumentException.class, () -> ffn.backward(new double[]{1, 2}, new double[]{1, Double.POSITIVE_INFINITY}));
        assertThrows(IllegalArgumentException.class, () -> ffn.backward(new double[][]{}, new double[][]{}));
        assertThrows(IllegalArgumentException.class, () -> ffn.backward(new double[][]{{1, 2}}, new double[][]{}));
    }

    @Test
    void backwardShouldNotMutateCallerInput() {
        double[] x = {0.6, -1.2};
        double[] dy = {0.7, -0.4};
        create(W1, B1, W2, B2).backward(x, dy);
        assertArrayEquals(new double[]{0.6, -1.2}, x);
        assertArrayEquals(new double[]{0.7, -0.4}, dy);
    }

    private static void assertParameterGradients(
            double[][] xs, double[][] dys,
            double[][] dW1, double[] dB1, double[][] dW2, double[] dB2) {
        // Numeryczny gradient wag pierwszej warstwy.
        for (int i = 0; i < W1.length; i++) for (int j = 0; j < W1[i].length; j++) {
            double[][] plus = copy(W1), minus = copy(W1);
            plus[i][j] += EPS;
            minus[i][j] -= EPS;
            double numeric = (objective(plus, B1, W2, B2, xs, dys)
                    - objective(minus, B1, W2, B2, xs, dys)) / (2 * EPS);
            assertEquals(numeric, dW1[i][j], TOL);
        }
        for (int j = 0; j < B1.length; j++) {
            double[] plus = B1.clone(), minus = B1.clone();
            plus[j] += EPS;
            minus[j] -= EPS;
            double numeric = (objective(W1, plus, W2, B2, xs, dys)
                    - objective(W1, minus, W2, B2, xs, dys)) / (2 * EPS);
            assertEquals(numeric, dB1[j], TOL);
        }
        // Numeryczny gradient wag drugiej warstwy.
        for (int i = 0; i < W2.length; i++) for (int j = 0; j < W2[i].length; j++) {
            double[][] plus = copy(W2), minus = copy(W2);
            plus[i][j] += EPS;
            minus[i][j] -= EPS;
            double numeric = (objective(W1, B1, plus, B2, xs, dys)
                    - objective(W1, B1, minus, B2, xs, dys)) / (2 * EPS);
            assertEquals(numeric, dW2[i][j], TOL);
        }
        for (int j = 0; j < B2.length; j++) {
            double[] plus = B2.clone(), minus = B2.clone();
            plus[j] += EPS;
            minus[j] -= EPS;
            double numeric = (objective(W1, B1, W2, plus, xs, dys)
                    - objective(W1, B1, W2, minus, xs, dys)) / (2 * EPS);
            assertEquals(numeric, dB2[j], TOL);
        }
    }

    private static double[][] copy(double[][] a) {
        double[][] b = new double[a.length][];
        for (int i = 0; i < a.length; i++) b[i] = a[i].clone();
        return b;
    }

    private static void accumulate(double[][] into, double[][] from) {
        for (int i = 0; i < into.length; i++) for (int j = 0; j < into[i].length; j++) into[i][j] += from[i][j];
    }

    private static void accumulate(double[] into, double[] from) {
        for (int i = 0; i < into.length; i++) into[i] += from[i];
    }
}
