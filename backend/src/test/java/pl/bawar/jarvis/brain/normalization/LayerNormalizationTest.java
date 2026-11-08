
package pl.bawar.jarvis.brain.normalization;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class LayerNormalizationTest {

    private static final double DELTA = 0.00001;

    @Test
    void shouldNormalizeVector() {

        LayerNormalization layer = new LayerNormalization(3, 1e-5);

        double[] result = layer.forward(
                new double[] { 1.0, 2.0, 3.0 });

        assertArrayEquals(
                new double[] {
                        -1.22473568,
                        0.0,
                        1.22473568
                },
                result,
                DELTA);
    }

    @Test
    void shouldReturnZeroForConstantVector() {

        LayerNormalization layer = new LayerNormalization(3, 1e-5);

        double[] result = layer.forward(
                new double[] { 5.0, 5.0, 5.0 });

        assertArrayEquals(
                new double[] { 0.0, 0.0, 0.0 },
                result,
                DELTA);
    }

    @Test
    void shouldNormalizeEachTokenSeparately() {

        LayerNormalization layer = new LayerNormalization(3, 1e-5);

        double[][] input = {
                { 1.0, 2.0, 3.0 },
                { 11.0, 12.0, 13.0 }
        };

        double[][] result = layer.forward(input);

        assertArrayEquals(result[0], result[1], DELTA);
        assertEquals(2, result.length);
        assertEquals(3, result[0].length);
    }

    @Test
    void shouldNotModifyInput() {

        LayerNormalization layer = new LayerNormalization(2, 1e-5);

        double[] input = { 2.0, 4.0 };

        layer.forward(input);

        assertArrayEquals(
                new double[] { 2.0, 4.0 },
                input,
                DELTA);
    }

    @Test
    void shouldRejectInvalidInput() {

        assertThrows(
                IllegalArgumentException.class,
                () -> new LayerNormalization(0, 1e-5));

        assertThrows(
                IllegalArgumentException.class,
                () -> new LayerNormalization(3, 0.0));

        LayerNormalization layer = new LayerNormalization(3, 1e-5);

        assertThrows(
                IllegalArgumentException.class,
                () -> layer.forward(new double[] { 1.0, 2.0 }));

        assertThrows(
                IllegalArgumentException.class,
                () -> layer.forward(
                        new double[] { 1.0, Double.NaN, 3.0 }));

        assertThrows(
                IllegalArgumentException.class,
                () -> layer.forward((double[][]) null));
    }
}
