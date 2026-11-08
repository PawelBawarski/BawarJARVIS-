package pl.bawar.jarvis.brain.attention;

import org.junit.jupiter.api.Test;
import pl.bawar.jarvis.brain.layers.DenseLayer;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class MultiHeadAttentionBackwardTest {

    private static final double EPS = 1e-6;
    private static final double TOL = 2e-6;
    private static final double[][] INPUT = {
            {0.6, -0.3}, {-0.8, 0.5}, {0.2, 1.1}
    };
    private static final double[][] UPSTREAM = {
            {0.7, -0.2}, {0.1, 0.4}, {-0.6, 0.3}
    };

    @Test
    void shouldPreserveForwardForTwoHeads() {
        DenseLayer identity = new DenseLayer(
                new double[][]{{1, 0}, {0, 1}}, new double[]{0, 0});
        CausalSelfAttention first = new CausalSelfAttention(identity, identity, identity);
        CausalSelfAttention second = new CausalSelfAttention(identity, identity,
                new DenseLayer(new double[][]{{2, 0}, {0, 2}}, new double[]{0, 0}));
        DenseLayer output = new DenseLayer(new double[][]{
                {1, 0}, {0, 1}, {1, 0}, {0, 1}
        }, new double[]{0, 0});
        MultiHeadAttention attention = new MultiHeadAttention(List.of(first, second), output);

        assertArrayEquals(new double[]{3.0, 6.0},
                attention.forward(new double[][]{{1.0, 2.0}})[0], 1e-12);
    }

    @Test
    void shouldReturnCorrectDimensionsAndSumOutputBiasGradients() {
        MultiHeadAttentionGradients result = model(new Parameters()).backward(INPUT, UPSTREAM);
        assertEquals(3, result.inputGradient().length);
        assertEquals(2, result.inputGradient()[0].length);
        assertEquals(2, result.headGradients().size());

        MultiHeadOutputProjectionGradients output = result.outputProjectionGradients();
        assertEquals(4, output.inputGradient()[0].length);
        assertEquals(4, output.weightGradients().length);
        assertEquals(2, output.weightGradients()[0].length);
        assertArrayEquals(new double[]{0.2, 0.5}, output.biasGradients(), 1e-12);
        for (CausalAttentionGradients head : result.headGradients()) {
            assertEquals(3, head.inputGradient().length);
            assertEquals(2, head.queryGradients().weightGradients().length);
            assertEquals(2, head.keyGradients().biasGradients().length);
            assertEquals(2, head.valueGradients().biasGradients().length);
        }
        assertThrows(UnsupportedOperationException.class, () -> result.headGradients().clear());
    }

    @Test
    void shouldMatchNumericalGradientOfEveryInputValue() {
        Parameters p = new Parameters();
        double[][] analytic = model(p).backward(INPUT, UPSTREAM).inputGradient();
        for (int t = 0; t < INPUT.length; t++) {
            for (int d = 0; d < INPUT[t].length; d++) {
                double[][] plus = copyMatrix(INPUT);
                double[][] minus = copyMatrix(INPUT);
                plus[t][d] += EPS;
                minus[t][d] -= EPS;
                double numeric = (objective(p, plus) - objective(p, minus)) / (2 * EPS);
                assertEquals(numeric, analytic[t][d], TOL,
                        "inputGradient token=" + t + " dimension=" + d);
            }
        }
    }

    @Test
    void shouldMatchNumericalGradientOfOutputProjectionWeightsAndBiases() {
        Parameters p = new Parameters();
        MultiHeadOutputProjectionGradients analytic = model(p).backward(INPUT, UPSTREAM).outputProjectionGradients();

        for (int i = 0; i < p.outputW.length; i++) {
            for (int j = 0; j < p.outputW[i].length; j++) {
                Parameters plus = p.copy();
                Parameters minus = p.copy();
                plus.outputW[i][j] += EPS;
                minus.outputW[i][j] -= EPS;
                double numeric = (objective(plus, INPUT) - objective(minus, INPUT)) / (2 * EPS);
                assertEquals(numeric, analytic.weightGradients()[i][j], TOL,
                        "output W[" + i + "][" + j + "]");
            }
        }
        for (int j = 0; j < p.outputB.length; j++) {
            Parameters plus = p.copy();
            Parameters minus = p.copy();
            plus.outputB[j] += EPS;
            minus.outputB[j] -= EPS;
            double numeric = (objective(plus, INPUT) - objective(minus, INPUT)) / (2 * EPS);
            assertEquals(numeric, analytic.biasGradients()[j], TOL,
                    "output b[" + j + "]");
        }
    }

    @Test
    void shouldMatchNumericalGradientsOfAllHeadsQkvWeightsAndBiases() {
        Parameters p = new Parameters();
        List<CausalAttentionGradients> heads = model(p).backward(INPUT, UPSTREAM).headGradients();
        for (int h = 0; h < 2; h++) {
            for (int projection = 0; projection < 3; projection++) {
                AttentionProjectionGradients analytic = getProjection(heads.get(h), projection);
                for (int i = 0; i < 2; i++) {
                    for (int j = 0; j < 2; j++) {
                        Parameters plus = p.copy();
                        Parameters minus = p.copy();
                        plus.headW[h][projection][i][j] += EPS;
                        minus.headW[h][projection][i][j] -= EPS;
                        double numeric = (objective(plus, INPUT) - objective(minus, INPUT)) / (2 * EPS);
                        assertEquals(numeric, analytic.weightGradients()[i][j], TOL,
                                "head " + h + " projection " + projection + " W[" + i + "][" + j + "]");
                    }
                }
                for (int j = 0; j < 2; j++) {
                    Parameters plus = p.copy();
                    Parameters minus = p.copy();
                    plus.headB[h][projection][j] += EPS;
                    minus.headB[h][projection][j] -= EPS;
                    double numeric = (objective(plus, INPUT) - objective(minus, INPUT)) / (2 * EPS);
                    assertEquals(numeric, analytic.biasGradients()[j], TOL,
                            "head " + h + " projection " + projection + " b[" + j + "]");
                }
            }
        }
    }

    @Test
    void shouldNotBackpropagateFromFirstOutputToFutureInputs() {
        double[][] firstOnly = {{0.5, -0.3}, {0, 0}, {0, 0}};
        double[][] gradients = model(new Parameters()).backward(INPUT, firstOnly).inputGradient();
        assertArrayEquals(new double[]{0.0, 0.0}, gradients[1], 1e-12);
        assertArrayEquals(new double[]{0.0, 0.0}, gradients[2], 1e-12);
    }

    @Test
    void shouldRejectInvalidGradients() {
        MultiHeadAttention attention = model(new Parameters());
        assertThrows(IllegalArgumentException.class, () -> attention.backward(INPUT, null));
        assertThrows(IllegalArgumentException.class, () -> attention.backward(INPUT, new double[0][]));
        assertThrows(IllegalArgumentException.class, () -> attention.backward(INPUT, new double[][]{{1, 2}}));
        assertThrows(IllegalArgumentException.class, () -> attention.backward(INPUT,
                new double[][]{{1, 2}, {3}, {4, 5}}));
        assertThrows(IllegalArgumentException.class, () -> attention.backward(INPUT,
                new double[][]{{1, 2}, {Double.NaN, 0}, {4, 5}}));
        assertThrows(IllegalArgumentException.class, () -> attention.backward(
                new double[][]{{1, Double.POSITIVE_INFINITY}}, new double[][]{{0, 0}}));
    }

    @Test
    void shouldNotModifyInputOrUpstreamGradient() {
        double[][] x = copyMatrix(INPUT);
        double[][] up = copyMatrix(UPSTREAM);
        MultiHeadAttention attention = model(new Parameters());
        double[][] before = attention.forward(x);
        attention.backward(x, up);
        double[][] after = attention.forward(x);
        for (int t = 0; t < x.length; t++) {
            assertArrayEquals(INPUT[t], x[t], 0);
            assertArrayEquals(UPSTREAM[t], up[t], 0);
            assertArrayEquals(before[t], after[t], 0);
        }
    }

    private static AttentionProjectionGradients getProjection(
            CausalAttentionGradients gradients, int index) {
        return switch (index) {
            case 0 -> gradients.queryGradients();
            case 1 -> gradients.keyGradients();
            case 2 -> gradients.valueGradients();
            default -> throw new IllegalArgumentException("Invalid projection");
        };
    }

    private static MultiHeadAttention model(Parameters p) {
        List<CausalSelfAttention> heads = new ArrayList<>();
        for (int h = 0; h < p.headW.length; h++) {
            heads.add(new CausalSelfAttention(
                    new DenseLayer(p.headW[h][0], p.headB[h][0]),
                    new DenseLayer(p.headW[h][1], p.headB[h][1]),
                    new DenseLayer(p.headW[h][2], p.headB[h][2])));
        }
        return new MultiHeadAttention(heads,
                new DenseLayer(p.outputW, p.outputB));
    }

    // Artificial linear objective: L = sum_{t,d} forward(X)[t][d] * UPSTREAM[t][d].
    // Its exact output gradient equals UPSTREAM, making numerical checks independent of CE.
    private static double objective(Parameters p, double[][] x) {
        double[][] y = model(p).forward(x);
        double value = 0.0;
        for (int t = 0; t < y.length; t++) {
            for (int d = 0; d < y[t].length; d++) {
                value += y[t][d] * UPSTREAM[t][d];
            }
        }
        return value;
    }

    private static double[][] copyMatrix(double[][] matrix) {
        double[][] copy = new double[matrix.length][];
        for (int i = 0; i < matrix.length; i++) {
            copy[i] = matrix[i].clone();
        }
        return copy;
    }

    private static final class Parameters {
        double[][][][] headW = {
                { // head 0: Wq, Wk, Wv
                        {{0.20, -0.10}, {0.05, 0.30}},
                        {{-0.25, 0.15}, {0.35, 0.10}},
                        {{0.40, 0.20}, {-0.15, 0.30}}
                },
                { // head 1
                        {{0.10, 0.25}, {-0.30, 0.15}},
                        {{0.20, -0.35}, {0.05, 0.25}},
                        {{-0.10, 0.45}, {0.30, -0.20}}
                }
        };
        double[][][] headB = {
                {{0.02, -0.03}, {0.01, 0.04}, {-0.02, 0.05}},
                {{-0.04, 0.01}, {0.03, -0.02}, {0.02, 0.01}}
        };
        double[][] outputW = {
                {0.10, 0.20}, {-0.30, 0.15}, {0.25, -0.20}, {0.40, 0.05}
        };
        double[] outputB = {0.03, -0.06};

        Parameters copy() {
            Parameters clone = new Parameters();
            for (int h = 0; h < headW.length; h++) {
                for (int p = 0; p < headW[h].length; p++) {
                    clone.headW[h][p] = copyMatrix(headW[h][p]);
                    clone.headB[h][p] = headB[h][p].clone();
                }
            }
            clone.outputW = copyMatrix(outputW);
            clone.outputB = outputB.clone();
            return clone;
        }
    }
}
