
package pl.bawar.jarvis.brain.attention;

import org.junit.jupiter.api.Test;
import pl.bawar.jarvis.brain.layers.DenseLayer;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class MultiHeadAttentionTest {

    private static final double DELTA = 0.000001;

    private DenseLayer identity() {
        return new DenseLayer(
                new double[][] {
                        { 1.0, 0.0 },
                        { 0.0, 1.0 }
                },
                new double[] { 0.0, 0.0 });
    }

    private CausalSelfAttention head(double multiplier) {

        DenseLayer valueProjection = new DenseLayer(
                new double[][] {
                        { multiplier, 0.0 },
                        { 0.0, multiplier }
                },
                new double[] { 0.0, 0.0 });

        return new CausalSelfAttention(
                identity(),
                identity(),
                valueProjection);
    }

    private DenseLayer outputProjection() {
        return new DenseLayer(
                new double[][] {
                        { 1.0, 0.0 },
                        { 0.0, 1.0 },
                        { 1.0, 0.0 },
                        { 0.0, 1.0 }
                },
                new double[] { 0.0, 0.0 });
    }

    private MultiHeadAttention createAttention() {
        return new MultiHeadAttention(
                List.of(head(1.0), head(2.0)),
                outputProjection());
    }

    @Test
    void shouldCombineResultsFromTwoHeads() {

        MultiHeadAttention attention = createAttention();

        double[][] result = attention.forward(
                new double[][] { { 1.0, 2.0 } });

        // Head 1: [1, 2]
        // Head 2: [2, 4]
        // Output: [3, 6]
        assertArrayEquals(
                new double[] { 3.0, 6.0 },
                result[0],
                DELTA);
    }

    @Test
    void shouldReturnCorrectDimensions() {

        MultiHeadAttention attention = createAttention();

        double[][] result = attention.forward(
                new double[][] {
                        { 1.0, 0.0 },
                        { 0.0, 1.0 },
                        { 1.0, 1.0 }
                });

        assertEquals(2, attention.headCount());
        assertEquals(2, attention.embeddingSize());
        assertEquals(3, result.length);
        assertEquals(2, result[0].length);
    }

    @Test
    void shouldNotLookAtFutureTokens() {

        MultiHeadAttention attention = createAttention();

        double[][] firstInput = {
                { 1.0, 0.0 },
                { 0.0, 1.0 },
                { 2.0, 2.0 }
        };

        double[][] changedFuture = {
                { 1.0, 0.0 },
                { 0.0, 1.0 },
                { 100.0, -100.0 }
        };

        double[][] firstResult = attention.forward(firstInput);

        double[][] secondResult = attention.forward(changedFuture);

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
    void shouldRejectInvalidProjection() {

        DenseLayer wrongProjection = new DenseLayer(
                new double[][] {
                        { 1.0, 0.0 },
                        { 0.0, 1.0 }
                },
                new double[] { 0.0, 0.0 });

        assertThrows(
                IllegalArgumentException.class,
                () -> new MultiHeadAttention(
                        List.of(head(1.0), head(2.0)),
                        wrongProjection));
    }

    @Test
    void shouldRejectMissingHeads() {

        assertThrows(
                IllegalArgumentException.class,
                () -> new MultiHeadAttention(
                        List.of(),
                        outputProjection()));

        assertThrows(
                IllegalArgumentException.class,
                () -> new MultiHeadAttention(
                        null,
                        outputProjection()));
    }

    @Test
    void shouldProtectHeadListFromChanges() {

        List<CausalSelfAttention> heads = new ArrayList<>();

        heads.add(head(1.0));
        heads.add(head(2.0));

        MultiHeadAttention attention = new MultiHeadAttention(
                heads,
                outputProjection());

        heads.clear();

        assertEquals(2, attention.headCount());

        assertEquals(
                1,
                attention.forward(
                        new double[][] { { 1.0, 2.0 } }).length);
    }

    @Test
    void shouldNotModifyInput() {

        MultiHeadAttention attention = createAttention();

        double[][] input = {
                { 1.0, 2.0 },
                { 3.0, 4.0 }
        };

        attention.forward(input);

        assertArrayEquals(
                new double[] { 1.0, 2.0 },
                input[0],
                DELTA);

        assertArrayEquals(
                new double[] { 3.0, 4.0 },
                input[1],
                DELTA);
    }
}
