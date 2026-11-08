
package pl.bawar.jarvis.brain.transformer;

import org.junit.jupiter.api.Test;

import pl.bawar.jarvis.brain.attention.CausalSelfAttention;
import pl.bawar.jarvis.brain.attention.MultiHeadAttention;
import pl.bawar.jarvis.brain.layers.DenseLayer;
import pl.bawar.jarvis.brain.layers.FeedForwardNetwork;
import pl.bawar.jarvis.brain.normalization.LayerNormalization;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class TransformerBlockTest {

    private static final double EPSILON = 1e-5;
    private static final double DELTA = 1e-6;

    private DenseLayer identity() {
        return new DenseLayer(
                new double[][] {
                        { 1.0, 0.0 },
                        { 0.0, 1.0 }
                },
                new double[] { 0.0, 0.0 });
    }

    private MultiHeadAttention createAttention(
            boolean zeroValues) {
        DenseLayer values = zeroValues
                ? new DenseLayer(
                        new double[2][2],
                        new double[2])
                : identity();

        CausalSelfAttention firstHead = new CausalSelfAttention(
                identity(),
                identity(),
                values);

        CausalSelfAttention secondHead = new CausalSelfAttention(
                identity(),
                identity(),
                values);

        // Łączymy obie głowice przez średnią.
        DenseLayer outputProjection = new DenseLayer(
                new double[][] {
                        { 0.5, 0.0 },
                        { 0.0, 0.5 },
                        { 0.5, 0.0 },
                        { 0.0, 0.5 }
                },
                new double[] { 0.0, 0.0 });

        return new MultiHeadAttention(
                List.of(firstHead, secondHead),
                outputProjection);
    }

    private FeedForwardNetwork createFeedForward(
            double firstBias,
            double secondBias) {
        // Warstwa 2 -> 3.
        DenseLayer first = new DenseLayer(
                new double[2][3],
                new double[3]);

        // Warstwa 3 -> 2.
        DenseLayer second = new DenseLayer(
                new double[3][2],
                new double[] { firstBias, secondBias });

        return new FeedForwardNetwork(first, second);
    }

    private TransformerBlock createBlock(
            boolean zeroAttention,
            double firstBias,
            double secondBias) {
        return new TransformerBlock(
                new LayerNormalization(2, EPSILON),
                createAttention(zeroAttention),
                new LayerNormalization(2, EPSILON),
                createFeedForward(firstBias, secondBias));
    }

    @Test
    void shouldCombineAttentionFeedForwardAndResiduals() {

        TransformerBlock block = createBlock(false, 0.25, -0.5);

        double[][] result = block.forward(
                new double[][] { { 2.0, 4.0 } });

        // LayerNorm([2,4]) = [-n,+n]
        // dla n = 1/sqrt(1+epsilon).
        double n = 1.0 / Math.sqrt(1.0 + EPSILON);

        // Attention zwraca [-n,+n].
        // FFN zwraca stały wektor [0.25,-0.5].
        assertArrayEquals(
                new double[] {
                        2.25 - n,
                        3.5 + n
                },
                result[0],
                DELTA);
    }

    @Test
    void shouldPreserveSequenceDimensions() {

        TransformerBlock block = createBlock(false, 0.0, 0.0);

        double[][] input = {
                { 1.0, 2.0 },
                { 3.0, 4.0 },
                { 5.0, 6.0 }
        };

        double[][] result = block.forward(input);

        assertEquals(2, block.embeddingSize());
        assertEquals(3, result.length);

        for (double[] token : result) {
            assertEquals(2, token.length);
        }
    }

    @Test
    void shouldNotLookAtFutureTokens() {

        TransformerBlock block = createBlock(false, 0.25, -0.5);

        double[][] firstInput = {
                { 1.0, 2.0 },
                { 3.0, 4.0 },
                { 5.0, 6.0 }
        };

        double[][] changedFuture = {
                { 1.0, 2.0 },
                { 3.0, 4.0 },
                { 100.0, -100.0 }
        };

        double[][] firstResult = block.forward(firstInput);

        double[][] secondResult = block.forward(changedFuture);

        // Zmiana trzeciego tokenu nie może
        // wpłynąć na dwa wcześniejsze.
        assertArrayEquals(
                firstResult[0],
                secondResult[0],
                DELTA);

        assertArrayEquals(
                firstResult[1],
                secondResult[1],
                DELTA);
    }

    @Test
    void shouldPreserveInputWhenBranchesReturnZero() {

        TransformerBlock block = createBlock(true, 0.0, 0.0);

        double[][] input = {
                { 2.0, 4.0 },
                { 1.0, 3.0 }
        };

        double[][] result = block.forward(input);

        // Attention = 0, FFN = 0.
        // Połączenia rezydualne zachowują X.
        assertArrayEquals(input[0], result[0], DELTA);
        assertArrayEquals(input[1], result[1], DELTA);
    }

    @Test
    void shouldNotModifyInput() {

        TransformerBlock block = createBlock(false, 0.0, 0.0);

        double[][] input = {
                { 1.0, 2.0 },
                { 3.0, 4.0 }
        };

        block.forward(input);

        assertArrayEquals(
                new double[] { 1.0, 2.0 },
                input[0],
                DELTA);

        assertArrayEquals(
                new double[] { 3.0, 4.0 },
                input[1],
                DELTA);
    }

    @Test
    void shouldRejectIncompatibleComponents() {

        assertThrows(
                IllegalArgumentException.class,
                () -> new TransformerBlock(
                        new LayerNormalization(3, EPSILON),
                        createAttention(false),
                        new LayerNormalization(2, EPSILON),
                        createFeedForward(0.0, 0.0)));

        assertThrows(
                IllegalArgumentException.class,
                () -> new TransformerBlock(
                        null,
                        createAttention(false),
                        new LayerNormalization(2, EPSILON),
                        createFeedForward(0.0, 0.0)));
    }

    @Test
    void shouldRejectInvalidInput() {

        TransformerBlock block = createBlock(false, 0.0, 0.0);

        assertThrows(
                IllegalArgumentException.class,
                () -> block.forward(null));

        assertThrows(
                IllegalArgumentException.class,
                () -> block.forward(new double[][] {}));

        assertThrows(
                IllegalArgumentException.class,
                () -> block.forward(
                        new double[][] { { 1.0 } }));

        assertThrows(
                IllegalArgumentException.class,
                () -> block.forward(
                        new double[][] { { Double.NaN, 1.0 } }));

        assertThrows(
                IllegalArgumentException.class,
                () -> block.forward(
                        new double[][] {
                                { Double.POSITIVE_INFINITY, 1.0 }
                        }));
    }
}
