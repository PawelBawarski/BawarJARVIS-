package pl.bawar.jarvis.brain.activation;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class GeluActivationBackwardTest {

    @Test
    void shouldHaveDerivativeOneHalfAtZero() {
        assertEquals(0.5, GeluActivation.derivative(0.0), 1e-12);
    }

    @Test
    void shouldMatchNumericalDerivative() {
        double h = 1e-6;
        for (double x : new double[]{-3.0, -1.0, -0.2, 0.0, 0.4, 1.0, 3.0}) {
            double numerical = (GeluActivation.apply(x + h)
                    - GeluActivation.apply(x - h)) / (2 * h);
            assertEquals(numerical, GeluActivation.derivative(x), 1e-6,
                    "Derivative mismatch for x=" + x);
        }
    }

    @Test
    void shouldApplyChainRuleElementwise() {
        double[] input = {-1.0, 0.0, 1.0};
        double[] upstream = {2.0, -3.0, 0.5};
        double[] gradient = GeluActivation.backward(input, upstream);
        for (int i = 0; i < input.length; i++) {
            assertEquals(upstream[i] * GeluActivation.derivative(input[i]),
                    gradient[i], 1e-12);
        }
        assertEquals(-1.5, gradient[1], 1e-12);
    }

    @Test
    void shouldHandleSaturatedInputsWithoutNan() {
        assertEquals(0.0, GeluActivation.derivative(-1e100), 0.0);
        assertEquals(1.0, GeluActivation.derivative(1e100), 0.0);
    }

    @Test
    void shouldRejectInvalidInputs() {
        assertThrows(IllegalArgumentException.class,
                () -> GeluActivation.derivative(Double.NaN));
        assertThrows(IllegalArgumentException.class,
                () -> GeluActivation.backward(new double[]{1.0}, new double[]{1.0, 2.0}));
        assertThrows(IllegalArgumentException.class,
                () -> GeluActivation.backward(new double[]{1.0}, new double[]{Double.POSITIVE_INFINITY}));
    }
}
