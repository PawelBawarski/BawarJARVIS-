package pl.bawar.jarvis.brain.optimization;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class AdamWOptimizerTest {

    @Test
    void shouldUpdateParametersAccordingToGradient() {
        AdamWOptimizer optimizer = new AdamWOptimizer(2, 0.1, 0.0);
        double[] weights = {1.0, -1.0};

        optimizer.step(weights, new double[]{2.0, -3.0});

        assertArrayEquals(new double[]{0.9, -0.9}, weights, 1e-8);
        assertEquals(1, optimizer.stepCount());
    }

    @Test
    void shouldKeepMomentsAcrossSteps() {
        AdamWOptimizer optimizer = new AdamWOptimizer(1, 0.1, 0.0);
        double[] weights = {1.0};

        optimizer.step(weights, new double[]{2.0});
        optimizer.step(weights, new double[]{2.0});

        assertEquals(0.8, weights[0], 1e-8);
        assertEquals(2, optimizer.stepCount());
    }

    @Test
    void shouldApplyDecoupledWeightDecayWithZeroGradient() {
        AdamWOptimizer optimizer = new AdamWOptimizer(1, 0.1, 0.01);
        double[] weights = {2.0};

        optimizer.step(weights, new double[]{0.0});

        assertEquals(1.998, weights[0], 1e-12);
    }

    @Test
    void shouldRejectInvalidDimensionsWithoutChangingStepCount() {
        AdamWOptimizer optimizer = new AdamWOptimizer(2, 0.1, 0.0);

        assertThrows(IllegalArgumentException.class,
                () -> optimizer.step(new double[]{1.0}, new double[]{0.5}));
        assertEquals(0, optimizer.stepCount());
    }

    @Test
    void shouldRejectNonFiniteGradient() {
        AdamWOptimizer optimizer = new AdamWOptimizer(1, 0.1, 0.0);

        assertThrows(IllegalArgumentException.class,
                () -> optimizer.step(new double[]{1.0}, new double[]{Double.NaN}));
    }

    @Test
    void shouldRejectInvalidHyperparameters() {
        assertThrows(IllegalArgumentException.class,
                () -> new AdamWOptimizer(0, 0.1, 0.0));
        assertThrows(IllegalArgumentException.class,
                () -> new AdamWOptimizer(1, 0.0, 0.0));
        assertThrows(IllegalArgumentException.class,
                () -> new AdamWOptimizer(1, 0.1, -0.01));
    }
}
