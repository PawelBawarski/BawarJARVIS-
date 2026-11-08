
package pl.bawar.jarvis.brain.math;

import org.junit.jupiter.api.Test;

import pl.bawar.jarvis.brain.attention.CausalSelfAttention;
import pl.bawar.jarvis.brain.attention.MultiHeadAttention;
import pl.bawar.jarvis.brain.layers.DenseLayer;
import pl.bawar.jarvis.brain.normalization.LayerNormalization;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class ResidualConnectionTest {

    private static final double DELTA = 0.000001;

    @Test
    void shouldAddTwoMatrices() {

        double[][] original = {
                { 1.0, 2.0 },
                { 3.0, 4.0 }
        };

        double[][] transformed = {
                { 0.5, -0.3 },
                { 1.0, 2.0 }
        };

        double[][] result = ResidualConnection.add(
                original,
                transformed);

        assertArrayEquals(
                new double[] { 1.5, 1.7 },
                result[0],
                DELTA);

        assertArrayEquals(
                new double[] { 4.0, 6.0 },
                result[1],
                DELTA);
    }

    @Test
    void shouldNotModifyInputs() {

        double[][] original = { { 1.0, 2.0 } };
        double[][] transformed = { { 3.0, 4.0 } };

        ResidualConnection.add(original, transformed);

        assertArrayEquals(
                new double[] { 1.0, 2.0 },
                original[0],
                DELTA);

        assertArrayEquals(
                new double[] { 3.0, 4.0 },
                transformed[0],
                DELTA);
    }

    @Test
    void shouldRejectDifferentDimensions() {

        assertThrows(
                IllegalArgumentException.class,
                () -> ResidualConnection.add(
                        new double[][] { { 1.0, 2.0 } },
                        new double[][] { { 1.0 } }));
    }

    @Test
    void shouldRejectNonFiniteValues() {

        assertThrows(
                IllegalArgumentException.class,
                () -> ResidualConnection.add(
                        new double[][] { { Double.NaN } },
                        new double[][] { { 1.0 } }));

        assertThrows(
                IllegalArgumentException.class,
                () -> ResidualConnection.add(
                        new double[][] { { Double.MAX_VALUE } },
                        new double[][] { { Double.MAX_VALUE } }));
    }

    @Test
    void shouldPreserveCausalityAfterNormalizationAndAttention() {

        DenseLayer identity = new DenseLayer(
                new double[][] {
                        { 1.0, 0.0 },
                        { 0.0, 1.0 }
                },
                new double[] { 0.0, 0.0 });

        CausalSelfAttention firstHead = new CausalSelfAttention(
                identity, identity, identity);

        CausalSelfAttention secondHead = new CausalSelfAttention(
                identity, identity, identity);

        DenseLayer outputProjection = new DenseLayer(
                new double[][] {
                        { 0.5, 0.0 },
                        { 0.0, 0.5 },
                        { 0.5, 0.0 },
                        { 0.0, 0.5 }
                },
                new double[] { 0.0, 0.0 });

        MultiHeadAttention attention = new MultiHeadAttention(
                List.of(firstHead, secondHead),
                outputProjection);

        LayerNormalization normalization = new LayerNormalization(2, 1e-5);

        double[][] original = {
                { 1.0, 0.0 },
                { 0.0, 1.0 },
                { 2.0, 3.0 }
        };

        double[][] changedFuture = {
                { 1.0, 0.0 },
                { 0.0, 1.0 },
                { 100.0, -100.0 }
        };

        double[][] firstResult = ResidualConnection.add(
                original,
                attention.forward(
                        normalization.forward(original)));

        double[][] secondResult = ResidualConnection.add(
                changedFuture,
                attention.forward(
                        normalization.forward(changedFuture)));

        // Zmiana przyszłego tokenu nie może
        // wpłynąć na wcześniejsze pozycje.
        assertArrayEquals(
                firstResult[0],
                secondResult[0],
                DELTA);

        assertArrayEquals(
                firstResult[1],
                secondResult[1],
                DELTA);

        assertEquals(3, firstResult.length);
        assertEquals(2, firstResult[0].length);
    }
}
