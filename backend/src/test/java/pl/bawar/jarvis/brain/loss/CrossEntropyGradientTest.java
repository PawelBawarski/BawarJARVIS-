
package pl.bawar.jarvis.brain.loss;

import org.junit.jupiter.api.Test;

import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.*;

class CrossEntropyGradientTest {

    @Test
    void shouldCalculateCorrectGradient() {
        double[] gradient = CrossEntropyGradient.calculate(
                new double[] { 2.0, 1.0, 0.0 },
                0);

        assertArrayEquals(
                new double[] {
                        -0.3347590442,
                        0.2447284711,
                        0.0900305732
                },
                gradient,
                1e-9);
    }

    @Test
    void shouldCalculateUniformGradient() {
        double[] gradient = CrossEntropyGradient.calculate(
                new double[] { 0.0, 0.0, 0.0 },
                1);

        assertArrayEquals(
                new double[] {
                        1.0 / 3.0,
                        -2.0 / 3.0,
                        1.0 / 3.0
                },
                gradient,
                1e-12);
    }

    @Test
    void shouldHaveGradientSumCloseToZero() {
        double[] gradient = CrossEntropyGradient.calculate(
                new double[] { 2.0, 1.0, 0.0 },
                0);

        assertEquals(
                0.0,
                Arrays.stream(gradient).sum(),
                1e-12);
    }

    @Test
    void shouldMatchNumericalGradient() {
        double[] logits = { 0.3, -0.2, 1.5 };
        int target = 1;
        double epsilon = 1e-6;

        double[] gradient = CrossEntropyGradient.calculate(
                logits, target);

        for (int i = 0; i < logits.length; i++) {
            double[] plus = logits.clone();
            double[] minus = logits.clone();

            plus[i] += epsilon;
            minus[i] -= epsilon;

            double lossPlus = CrossEntropyLoss.calculate(
                    plus, target);

            double lossMinus = CrossEntropyLoss.calculate(
                    minus, target);

            double numericalGradient = (lossPlus - lossMinus) / (2 * epsilon);

            assertEquals(
                    numericalGradient,
                    gradient[i],
                    1e-6);
        }
    }

    @Test
    void shouldReduceLossAfterGradientStep() {
        double[] logits = { 2.0, 1.0, 0.0 };
        int target = 0;
        double learningRate = 0.1;

        double before = CrossEntropyLoss.calculate(
                logits, target);

        double[] gradient = CrossEntropyGradient.calculate(
                logits, target);

        double[] updatedLogits = logits.clone();

        for (int i = 0; i < updatedLogits.length; i++) {
            updatedLogits[i] -= learningRate * gradient[i];
        }

        double after = CrossEntropyLoss.calculate(
                updatedLogits, target);

        assertTrue(after < before);
    }

    @Test
    void shouldRemainStableForLargeLogits() {
        double[] gradient = CrossEntropyGradient.calculate(
                new double[] { 1001.0, 1000.0 },
                0);

        assertEquals(-0.2689414214, gradient[0], 1e-9);
        assertEquals(0.2689414214, gradient[1], 1e-9);
    }

    @Test
    void shouldRejectInvalidTarget() {
        assertThrows(
                IllegalArgumentException.class,
                () -> CrossEntropyGradient.calculate(
                        new double[] { 1.0, 2.0 },
                        5));
    }

    @Test
    void shouldRejectNonFiniteLogits() {
        assertThrows(
                IllegalArgumentException.class,
                () -> CrossEntropyGradient.calculate(
                        new double[] { Double.NaN, 1.0 },
                        0));
    }
}
