
package pl.bawar.jarvis.brain.activation;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class GeluActivationTest {

    private static final double DELTA = 0.000001;

    @Test
    void shouldReturnZeroForZeroInput() {
        double result = GeluActivation.apply(0.0);

        assertEquals(0.0, result, DELTA);
    }

    @Test
    void shouldCalculatePositiveValue() {
        double result = GeluActivation.apply(1.0);

        assertEquals(0.84119199, result, DELTA);
    }

    @Test
    void shouldCalculateNegativeValue() {
        double result = GeluActivation.apply(-1.0);

        assertEquals(-0.15880801, result, DELTA);
    }

    @Test
    void shouldApplyGeluToVector() {
        double[] inputs = { -1.0, 0.0, 1.0 };

        double[] results = GeluActivation.apply(inputs);

        assertArrayEquals(
                new double[] {
                        -0.15880801,
                        0.0,
                        0.84119199
                },
                results,
                DELTA);
    }

    @Test
    void shouldNotModifyInputVector() {
        double[] inputs = { -1.0, 0.0, 1.0 };

        GeluActivation.apply(inputs);

        assertArrayEquals(
                new double[] { -1.0, 0.0, 1.0 },
                inputs,
                DELTA);
    }

    @Test
    void shouldRejectInvalidInputs() {
        assertThrows(
                IllegalArgumentException.class,
                () -> GeluActivation.apply(Double.NaN));

        assertThrows(
                IllegalArgumentException.class,
                () -> GeluActivation.apply(
                        Double.POSITIVE_INFINITY));

        assertThrows(
                IllegalArgumentException.class,
                () -> GeluActivation.apply((double[]) null));

        assertThrows(
                IllegalArgumentException.class,
                () -> GeluActivation.apply(new double[] {}));
    }
}
