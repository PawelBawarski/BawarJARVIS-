package pl.bawar.jarvis.brain.transformer;

import org.junit.jupiter.api.Test;
import pl.bawar.jarvis.brain.attention.CausalSelfAttention;
import pl.bawar.jarvis.brain.attention.MultiHeadAttention;
import pl.bawar.jarvis.brain.attention.CausalAttentionGradients;
import pl.bawar.jarvis.brain.layers.DenseLayer;
import pl.bawar.jarvis.brain.layers.FeedForwardNetwork;
import pl.bawar.jarvis.brain.normalization.LayerNormalization;

import java.util.ArrayList;
import java.util.List;
import java.util.function.DoubleConsumer;

import static org.junit.jupiter.api.Assertions.*;

class TransformerBlockBackwardTest {

    private static final double EPS = 1e-6;
    private static final double TOL = 4e-6;
    private static final double[][] INPUT = {
            {0.9, -0.7, 0.2},
            {-0.4, 0.8, 0.5},
            {0.6, 0.1, -0.9}
    };
    private static final double[][] UPSTREAM = {
            {0.6, -0.3, 0.2},
            {-0.5, 0.2, 0.4},
            {0.1, 0.7, -0.6}
    };

    @Test
    void shouldReturnAllGradientsWithCorrectShapes() {
        TransformerBlock block = model(new Parameters());
        double[][] output = block.forward(INPUT);
        assertEquals(3, output.length);
        assertEquals(3, output[0].length);

        TransformerBlockGradients g = block.backward(INPUT, UPSTREAM);
        assertEquals(3, g.inputGradients().length);
        assertEquals(3, g.inputGradients()[0].length);
        assertEquals(2, g.attentionGradients().headGradients().size());
        assertEquals(6, g.attentionGradients().outputProjectionGradients().weightGradients().length);
        assertEquals(3, g.attentionNormGradients().gammaGradients().length);
        assertEquals(3, g.attentionNormGradients().betaGradients().length);
        assertEquals(3, g.feedForwardNormGradients().gammaGradients().length);
        assertEquals(3, g.feedForwardNormGradients().betaGradients().length);
        assertEquals(3, g.feedForwardGradients().inputWeightGradients().length);
        assertEquals(4, g.feedForwardGradients().inputWeightGradients()[0].length);
        assertEquals(4, g.feedForwardGradients().outputWeightGradients().length);
        assertEquals(3, g.feedForwardGradients().outputWeightGradients()[0].length);
    }

    @Test
    void shouldMatchNumericalGradientForEveryInputValue() {
        Parameters p = new Parameters();
        double[][] analytic = model(p).backward(INPUT, UPSTREAM).inputGradients();
        for (int t = 0; t < INPUT.length; t++) {
            for (int d = 0; d < INPUT[t].length; d++) {
                double[][] plus = copy(INPUT);
                double[][] minus = copy(INPUT);
                plus[t][d] += EPS;
                minus[t][d] -= EPS;
                double numeric = (objective(p, plus) - objective(p, minus)) / (2 * EPS);
                assertEquals(numeric, analytic[t][d], TOL, "dInput[" + t + "][" + d + "]");
            }
        }
    }

    @Test
    void shouldMatchNumericalGradientsOfBothLayerNorms() {
        Parameters p = new Parameters();
        TransformerBlockGradients g = model(p).backward(INPUT, UPSTREAM);
        for (int d = 0; d < 3; d++) {
            final int j = d;
            assertNumeric(p, p.norm1Gamma[d], v -> p.norm1Gamma[j] = v,
                    g.attentionNormGradients().gammaGradients()[d], "LN1 gamma " + d);
            assertNumeric(p, p.norm1Beta[d], v -> p.norm1Beta[j] = v,
                    g.attentionNormGradients().betaGradients()[d], "LN1 beta " + d);
            assertNumeric(p, p.norm2Gamma[d], v -> p.norm2Gamma[j] = v,
                    g.feedForwardNormGradients().gammaGradients()[d], "LN2 gamma " + d);
            assertNumeric(p, p.norm2Beta[d], v -> p.norm2Beta[j] = v,
                    g.feedForwardNormGradients().betaGradients()[d], "LN2 beta " + d);
        }
    }

    @Test
    void shouldMatchNumericalGradientsOfSharedAttentionAndFeedForwardWeights() {
        Parameters p = new Parameters();
        TransformerBlockGradients g = model(p).backward(INPUT, UPSTREAM);
        for (int i = 0; i < 6; i++) {
            for (int j = 0; j < 3; j++) {
                final int row = i, col = j;
                assertNumeric(p, p.outputW[i][j], v -> p.outputW[row][col] = v,
                        g.attentionGradients().outputProjectionGradients().weightGradients()[i][j],
                        "MHA output W " + i + "," + j);
            }
        }
        for (int i = 0; i < 3; i++) {
            for (int j = 0; j < 4; j++) {
                final int row = i, col = j;
                assertNumeric(p, p.ffnW1[i][j], v -> p.ffnW1[row][col] = v,
                        g.feedForwardGradients().inputWeightGradients()[i][j],
                        "FFN W1 " + i + "," + j);
            }
        }
        for (int i = 0; i < 4; i++) {
            for (int j = 0; j < 3; j++) {
                final int row = i, col = j;
                assertNumeric(p, p.ffnW2[i][j], v -> p.ffnW2[row][col] = v,
                        g.feedForwardGradients().outputWeightGradients()[i][j],
                        "FFN W2 " + i + "," + j);
            }
        }
    }

    @Test
    void shouldMatchNumericalGradientsOfHeadQkvParametersAndBiases() {
        Parameters p = new Parameters();
        TransformerBlockGradients g = model(p).backward(INPUT, UPSTREAM);
        for (int h = 0; h < 2; h++) {
            CausalAttentionGradients gh = g.attentionGradients().headGradients().get(h);
            double[][][] analyticW = {
                    gh.queryGradients().weightGradients(),
                    gh.keyGradients().weightGradients(),
                    gh.valueGradients().weightGradients()
            };
            double[][] analyticB = {
                    gh.queryGradients().biasGradients(),
                    gh.keyGradients().biasGradients(),
                    gh.valueGradients().biasGradients()
            };
            for (int projection = 0; projection < 3; projection++) {
                for (int i = 0; i < 3; i++) {
                    for (int j = 0; j < 3; j++) {
                        final int head = h, proj = projection, row = i, col = j;
                        assertNumeric(p, p.headW[h][projection][i][j],
                                v -> p.headW[head][proj][row][col] = v,
                                analyticW[projection][i][j],
                                "Head " + h + " QKV " + projection + " weight " + i + "," + j);
                    }
                    final int head = h, proj = projection, column = i;
                    assertNumeric(p, p.headB[h][projection][i],
                            v -> p.headB[head][proj][column] = v,
                            analyticB[projection][i],
                            "Head " + h + " QKV " + projection + " bias " + i);
                }
            }
        }
    }

    @Test
    void shouldMatchNumericalGradientsOfOutputAndFeedForwardBiases() {
        Parameters p = new Parameters();
        TransformerBlockGradients g = model(p).backward(INPUT, UPSTREAM);
        for (int i = 0; i < 3; i++) {
            final int j = i;
            assertNumeric(p, p.outputB[i], v -> p.outputB[j] = v,
                    g.attentionGradients().outputProjectionGradients().biasGradients()[i], "MHA output bias");
            assertNumeric(p, p.ffnB2[i], v -> p.ffnB2[j] = v,
                    g.feedForwardGradients().outputBiasGradients()[i], "FFN output bias");
        }
        for (int i = 0; i < 4; i++) {
            final int j = i;
            assertNumeric(p, p.ffnB1[i], v -> p.ffnB1[j] = v,
                    g.feedForwardGradients().inputBiasGradients()[i], "FFN input bias");
        }
    }

    @Test
    void shouldRespectCausalMaskEvenThroughResidualAndLayerNorm() {
        double[][] firstTokenOnly = {{0.7, -0.4, 0.1}, {0, 0, 0}, {0, 0, 0}};
        double[][] dInput = model(new Parameters()).backward(INPUT, firstTokenOnly).inputGradients();
        assertArrayEquals(new double[]{0, 0, 0}, dInput[1], 1e-12);
        assertArrayEquals(new double[]{0, 0, 0}, dInput[2], 1e-12);
    }

    @Test
    void shouldNotMutateForwardInputsOrExistingParameters() {
        TransformerBlock block = model(new Parameters());
        double[][] x = copy(INPUT);
        double[][] dy = copy(UPSTREAM);
        double[][] before = block.forward(x);
        block.backward(x, dy);
        double[][] after = block.forward(x);
        for (int t = 0; t < x.length; t++) {
            assertArrayEquals(INPUT[t], x[t], 0.0);
            assertArrayEquals(UPSTREAM[t], dy[t], 0.0);
            assertArrayEquals(before[t], after[t], 0.0);
        }
    }

    @Test
    void shouldRejectInvalidGradients() {
        TransformerBlock block = model(new Parameters());
        assertThrows(IllegalArgumentException.class, () -> block.backward(INPUT, null));
        assertThrows(IllegalArgumentException.class, () -> block.backward(INPUT, new double[0][]));
        assertThrows(IllegalArgumentException.class, () -> block.backward(INPUT, new double[][]{{1, 2, 3}}));
        assertThrows(IllegalArgumentException.class, () -> block.backward(INPUT,
                new double[][]{{1, 2, 3}, {0, 0}, {2, 3, 4}}));
        assertThrows(IllegalArgumentException.class, () -> block.backward(INPUT,
                new double[][]{{1, 2, 3}, {0, Double.NaN, 0}, {2, 3, 4}}));
    }

    private static void assertNumeric(
            Parameters p, double original, DoubleConsumer set,
            double analytic, String description) {
        set.accept(original + EPS);
        double plus = objective(p, INPUT);
        set.accept(original - EPS);
        double minus = objective(p, INPUT);
        set.accept(original);
        assertEquals((plus - minus) / (2 * EPS), analytic, TOL, description);
    }

    private static double objective(Parameters p, double[][] input) {
        double[][] output = model(p).forward(input);
        double sum = 0;
        for (int t = 0; t < output.length; t++) {
            for (int d = 0; d < output[t].length; d++) {
                sum += UPSTREAM[t][d] * output[t][d];
            }
        }
        return sum;
    }

    private static TransformerBlock model(Parameters p) {
        LayerNormalization norm1 = new LayerNormalization(3, 1e-5);
        norm1.setAffineParameters(p.norm1Gamma, p.norm1Beta);
        LayerNormalization norm2 = new LayerNormalization(3, 1e-5);
        norm2.setAffineParameters(p.norm2Gamma, p.norm2Beta);
        List<CausalSelfAttention> heads = new ArrayList<>();
        for (int h = 0; h < 2; h++) {
            heads.add(new CausalSelfAttention(
                    new DenseLayer(p.headW[h][0], p.headB[h][0]),
                    new DenseLayer(p.headW[h][1], p.headB[h][1]),
                    new DenseLayer(p.headW[h][2], p.headB[h][2])));
        }
        MultiHeadAttention attention = new MultiHeadAttention(heads,
                new DenseLayer(p.outputW, p.outputB));
        FeedForwardNetwork ffn = new FeedForwardNetwork(
                new DenseLayer(p.ffnW1, p.ffnB1),
                new DenseLayer(p.ffnW2, p.ffnB2));
        return new TransformerBlock(norm1, attention, norm2, ffn);
    }

    private static double[][] copy(double[][] input) {
        double[][] result = new double[input.length][];
        for (int i = 0; i < input.length; i++) {
            result[i] = input[i].clone();
        }
        return result;
    }

    private static double[][] matrix(int rows, int cols, int seed) {
        double[][] result = new double[rows][cols];
        for (int i = 0; i < rows; i++) {
            for (int j = 0; j < cols; j++) {
                result[i][j] = Math.sin(seed + 2.9 * i + 1.7 * j) * 0.22;
            }
        }
        return result;
    }

    private static double[] vector(int n, int seed) {
        double[] result = new double[n];
        for (int i = 0; i < n; i++) {
            result[i] = Math.cos(seed + i * 1.6) * 0.04;
        }
        return result;
    }

    private static final class Parameters {
        final double[][][][] headW = new double[2][3][][];
        final double[][][] headB = new double[2][3][];
        final double[][] outputW = matrix(6, 3, 30);
        final double[] outputB = vector(3, 31);
        final double[][] ffnW1 = matrix(3, 4, 40);
        final double[] ffnB1 = vector(4, 41);
        final double[][] ffnW2 = matrix(4, 3, 42);
        final double[] ffnB2 = vector(3, 43);
        final double[] norm1Gamma = {1.12, 0.94, 1.07};
        final double[] norm1Beta = {0.02, -0.06, 0.03};
        final double[] norm2Gamma = {0.91, 1.09, 0.97};
        final double[] norm2Beta = {-0.04, 0.01, 0.05};

        Parameters() {
            for (int h = 0; h < 2; h++) {
                for (int p = 0; p < 3; p++) {
                    headW[h][p] = matrix(3, 3, 100 + h * 13 + p * 3);
                    headB[h][p] = vector(3, 200 + h * 13 + p * 3);
                }
            }
        }
    }
}
