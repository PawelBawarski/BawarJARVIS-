
package pl.bawar.jarvis.brain.attention;

import org.junit.jupiter.api.Test;
import pl.bawar.jarvis.brain.layers.DenseLayer;

import static org.junit.jupiter.api.Assertions.*;

class CausalSelfAttentionTest {

    private static final double DELTA = 0.000001;

    // Warstwa z macierzą jednostkową:
    // [1, 0]
    // [0, 1]
    private DenseLayer identityLayer() {
        return new DenseLayer(
                new double[][] {
                        { 1.0, 0.0 },
                        { 0.0, 1.0 }
                },
                new double[] { 0.0, 0.0 });
    }

    private CausalSelfAttention createAttention() {
        return new CausalSelfAttention(
                identityLayer(),
                identityLayer(),
                identityLayer());
    }

    @Test
    void shouldCalculateScaledDotProductAttention() {

        CausalSelfAttention attention = createAttention();

        double[][] input = {
                { 1.0, 0.0 },
                { 0.0, 1.0 }
        };

        double[][] output = attention.forward(input);

        // Pierwszy token widzi tylko siebie.
        assertArrayEquals(
                new double[] { 1.0, 0.0 },
                output[0],
                DELTA);

        // Drugi token widzi obydwa tokeny.
        assertArrayEquals(
                new double[] { 0.33023845, 0.66976155 },
                output[1],
                DELTA);
    }

    @Test
    void shouldNotLookAtFutureTokens() {

        CausalSelfAttention attention = createAttention();

        double[][] firstInput = {
                { 1.0, 0.0 },
                { 0.0, 1.0 },
                { 2.0, 0.0 }
        };

        double[][] changedFuture = {
                { 1.0, 0.0 },
                { 0.0, 1.0 },
                { 100.0, -100.0 }
        };

        double[][] firstResult = attention.forward(firstInput);

        double[][] secondResult = attention.forward(changedFuture);

        // Zmiana trzeciego tokenu nie może
        // wpłynąć na wyniki pierwszych dwóch.
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
    void shouldUseValueProjection() {

        DenseLayer valueProjection = new DenseLayer(
                new double[][] {
                        { 2.0, 0.0 },
                        { 0.0, 3.0 }
                },
                new double[] { 0.5, -0.5 });

        CausalSelfAttention attention = new CausalSelfAttention(
                identityLayer(),
                identityLayer(),
                valueProjection);

        double[][] result = attention.forward(
                new double[][] {
                        { 1.0, 2.0 }
                });

        // Jeden token: waga Attention wynosi 1.
        assertArrayEquals(
                new double[] { 2.5, 5.5 },
                result[0],
                DELTA);
    }

    @Test
    void shouldReturnCorrectDimensions() {

        CausalSelfAttention attention = createAttention();

        double[][] result = attention.forward(
                new double[][] {
                        { 1.0, 0.0 },
                        { 0.0, 1.0 },
                        { 1.0, 1.0 }
                });

        assertEquals(2, attention.embeddingSize());
        assertEquals(3, result.length);
        assertEquals(2, result[0].length);
    }

    @Test
    void shouldRejectInvalidInput() {

        CausalSelfAttention attention = createAttention();

        assertThrows(
                IllegalArgumentException.class,
                () -> attention.forward(null));

        assertThrows(
                IllegalArgumentException.class,
                () -> attention.forward(new double[][] {}));

        assertThrows(
                IllegalArgumentException.class,
                () -> attention.forward(
                        new double[][] { { 1.0 } }));

        assertThrows(
                IllegalArgumentException.class,
                () -> attention.forward(
                        new double[][] { { Double.NaN, 1.0 } }));
    }

    @Test
    void shouldRejectIncompatibleProjections() {

        DenseLayer wrongSize = new DenseLayer(
                new double[][] {
                        { 1.0, 0.0, 0.0 },
                        { 0.0, 1.0, 0.0 }
                },
                new double[] { 0.0, 0.0, 0.0 });

        assertThrows(
                IllegalArgumentException.class,
                () -> new CausalSelfAttention(
                        identityLayer(),
                        identityLayer(),
                        wrongSize));
    }

    @Test
    void shouldNotModifyInput() {

        CausalSelfAttention attention = createAttention();

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
