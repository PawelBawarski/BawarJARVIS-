package pl.bawar.jarvis.brain.attention;

import org.junit.jupiter.api.Test;
import pl.bawar.jarvis.brain.layers.DenseLayer;

import static org.junit.jupiter.api.Assertions.*;

class CausalSelfAttentionBackwardTest {

    private static final double EPS = 1e-6;
    private static final double TOLERANCE = 2e-6;

    private static final double[][] Q_WEIGHTS = {{0.4, -0.1}, {0.2, 0.3}};
    private static final double[][] K_WEIGHTS = {{-0.2, 0.5}, {0.6, 0.1}};
    private static final double[][] V_WEIGHTS = {{0.7, -0.4}, {0.1, 0.8}};
    private static final double[] Q_BIASES = {0.1, -0.2};
    private static final double[] K_BIASES = {-0.1, 0.05};
    private static final double[] V_BIASES = {0.2, 0.3};

    private static final double[][] INPUT = {{0.7, -0.3}, {0.2, 0.8}, {-0.6, 0.4}};
    private static final double[][] UPSTREAM = {{0.2, -0.1}, {-0.3, 0.6}, {0.7, 0.25}};

    private static CausalSelfAttention create(
            double[][] qw, double[] qb,
            double[][] kw, double[] kb,
            double[][] vw, double[] vb) {
        return new CausalSelfAttention(
                new DenseLayer(qw, qb),
                new DenseLayer(kw, kb),
                new DenseLayer(vw, vb));
    }

    private static CausalSelfAttention create() {
        return create(Q_WEIGHTS, Q_BIASES, K_WEIGHTS, K_BIASES, V_WEIGHTS, V_BIASES);
    }

    @Test
    void shouldReturnCorrectGradientDimensionsAndFiniteValues() {
        CausalAttentionGradients g = create().backward(INPUT, UPSTREAM);
        assertEquals(3, g.inputGradient().length);
        for (double[] row : g.inputGradient()) {
            assertEquals(2, row.length);
            for (double value : row) assertTrue(Double.isFinite(value));
        }
        for (AttentionProjectionGradients p : new AttentionProjectionGradients[]{
                g.queryGradients(), g.keyGradients(), g.valueGradients()}) {
            assertEquals(2, p.weightGradients().length);
            assertEquals(2, p.weightGradients()[0].length);
            assertEquals(2, p.biasGradients().length);
        }
    }

    @Test
    void shouldRespectCausalMaskDuringBackward() {
        // Only output at position 0 contributes to loss. Future inputs must have ZERO gradients.
        double[][] upstream = {{0.4, -0.2}, {0, 0}, {0, 0}};
        CausalAttentionGradients g = create().backward(INPUT, upstream);
        assertArrayEquals(new double[]{0, 0}, g.inputGradient()[1], 1e-12);
        assertArrayEquals(new double[]{0, 0}, g.inputGradient()[2], 1e-12);
        // First token can attend only to itself: Q and K do not affect its softmax([score]) = [1].
        for (double[] row : g.queryGradients().weightGradients()) {
            assertArrayEquals(new double[]{0, 0}, row, 1e-12);
        }
        for (double[] row : g.keyGradients().weightGradients()) {
            assertArrayEquals(new double[]{0, 0}, row, 1e-12);
        }
    }

    @Test
    void shouldMatchNumericalGradientForEveryInputValue() {
        CausalAttentionGradients g = create().backward(INPUT, UPSTREAM);
        for (int i = 0; i < INPUT.length; i++) {
            for (int j = 0; j < INPUT[i].length; j++) {
                double[][] plus = copy(INPUT), minus = copy(INPUT);
                plus[i][j] += EPS;
                minus[i][j] -= EPS;
                double numerical = (loss(create(), plus) - loss(create(), minus)) / (2 * EPS);
                assertEquals(numerical, g.inputGradient()[i][j], TOLERANCE,
                        "Input gradient mismatch at token=" + i + ", dim=" + j);
            }
        }
    }

    @Test
    void shouldMatchNumericalGradientForAllQKVWeights() {
        CausalAttentionGradients g = create().backward(INPUT, UPSTREAM);
        AttentionProjectionGradients[] expected = {
                g.queryGradients(), g.keyGradients(), g.valueGradients()
        };
        for (int p = 0; p < 3; p++) {
            for (int i = 0; i < 2; i++) {
                for (int j = 0; j < 2; j++) {
                    double[][][] plus = weights(), minus = weights();
                    plus[p][i][j] += EPS;
                    minus[p][i][j] -= EPS;
                    double numerical = (loss(withWeights(plus), INPUT)
                            - loss(withWeights(minus), INPUT)) / (2 * EPS);
                    assertEquals(numerical, expected[p].weightGradients()[i][j], TOLERANCE,
                            "Weight gradient mismatch at projection=" + p + ", row=" + i + ", col=" + j);
                }
            }
        }
    }

    @Test
    void shouldMatchNumericalGradientForAllQKVBiases() {
        CausalAttentionGradients g = create().backward(INPUT, UPSTREAM);
        AttentionProjectionGradients[] expected = {
                g.queryGradients(), g.keyGradients(), g.valueGradients()
        };
        for (int p = 0; p < 3; p++) {
            for (int j = 0; j < 2; j++) {
                double[][] plus = biases(), minus = biases();
                plus[p][j] += EPS;
                minus[p][j] -= EPS;
                double numerical = (loss(withBiases(plus), INPUT)
                        - loss(withBiases(minus), INPUT)) / (2 * EPS);
                assertEquals(numerical, expected[p].biasGradients()[j], TOLERANCE,
                        "Bias gradient mismatch at projection=" + p + ", col=" + j);
            }
        }
    }

    @Test
    void shouldNotChangeInputsOrParametersDuringBackward() {
        double[][] original = copy(INPUT);
        CausalSelfAttention attention = create();
        double[][] before = attention.forward(INPUT);
        attention.backward(INPUT, UPSTREAM);
        double[][] after = attention.forward(INPUT);
        for (int i = 0; i < INPUT.length; i++) {
            assertArrayEquals(original[i], INPUT[i], 0);
            assertArrayEquals(before[i], after[i], 0);
        }
    }

    @Test
    void shouldRejectInvalidGradientShapesAndNumbers() {
        CausalSelfAttention attention = create();
        assertThrows(IllegalArgumentException.class, () -> attention.backward(null, UPSTREAM));
        assertThrows(IllegalArgumentException.class, () -> attention.backward(INPUT, null));
        assertThrows(IllegalArgumentException.class, () -> attention.backward(INPUT, new double[][]{{1, 2}}));
        assertThrows(IllegalArgumentException.class, () -> attention.backward(INPUT, new double[][]{{1, 2}, {3}, {4, 5}}));
        assertThrows(IllegalArgumentException.class, () -> attention.backward(INPUT,
                new double[][]{{1, 2}, {Double.NaN, 1}, {0, 0}}));
    }

    private static double loss(CausalSelfAttention layer, double[][] input) {
        double[][] output = layer.forward(input);
        double sum = 0;
        for (int i = 0; i < output.length; i++) {
            for (int j = 0; j < output[i].length; j++) {
                sum += output[i][j] * UPSTREAM[i][j];
            }
        }
        return sum;
    }

    private static double[][] copy(double[][] matrix) {
        double[][] result = new double[matrix.length][];
        for (int i = 0; i < matrix.length; i++) result[i] = matrix[i].clone();
        return result;
    }

    private static double[][][] weights() {
        return new double[][][]{copy(Q_WEIGHTS), copy(K_WEIGHTS), copy(V_WEIGHTS)};
    }

    private static double[][] biases() {
        return new double[][]{Q_BIASES.clone(), K_BIASES.clone(), V_BIASES.clone()};
    }

    private static CausalSelfAttention withWeights(double[][][] matrices) {
        return create(matrices[0], Q_BIASES, matrices[1], K_BIASES, matrices[2], V_BIASES);
    }

    private static CausalSelfAttention withBiases(double[][] vectors) {
        return create(Q_WEIGHTS, vectors[0], K_WEIGHTS, vectors[1], V_WEIGHTS, vectors[2]);
    }
}
