
package pl.bawar.jarvis.brain.loss;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class CrossEntropyLossTest {

    @Test
    void shouldCalculateLossForCorrectPrediction() {
        double loss = CrossEntropyLoss.calculate(
                new double[] { 2.0, 1.0, 0.0 },
                0);

        assertEquals(0.4076059644, loss, 1e-9);
    }

    @Test
    void shouldGiveHigherLossForUnlikelyTarget() {
        double loss = CrossEntropyLoss.calculate(
                new double[] { 2.0, 1.0, 0.0 },
                2);

        assertEquals(2.4076059644, loss, 1e-9);
    }

    @Test
    void shouldHandleUniformPredictions() {
        double loss = CrossEntropyLoss.calculate(
                new double[] { 0.0, 0.0, 0.0 },
                1);

        assertEquals(Math.log(3), loss, 1e-9);
    }

    @Test
    void shouldRemainStableForLargeLogits() {
        double loss = CrossEntropyLoss.calculate(
                new double[] { 1001.0, 1000.0 },
                0);

        assertEquals(0.3132616875, loss, 1e-9);
    }

    @Test
    void shouldRejectInvalidTarget() {
        assertThrows(
                IllegalArgumentException.class,
                () -> CrossEntropyLoss.calculate(
                        new double[] { 1.0, 2.0 },
                        5));
    }

    @Test
    void shouldRejectNonFiniteLogits() {
        assertThrows(
                IllegalArgumentException.class,
                () -> CrossEntropyLoss.calculate(
                        new double[] { Double.NaN, 2.0 },
                        1));
    }
}
