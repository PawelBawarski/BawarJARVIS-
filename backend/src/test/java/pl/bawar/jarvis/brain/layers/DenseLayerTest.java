
package pl.bawar.jarvis.brain.layers;

import org.junit.jupiter.api.Test;

import pl.bawar.jarvis.brain.activation.GeluActivation;

import static org.junit.jupiter.api.Assertions.*;

class DenseLayerTest {

    @Test
    void shouldCalculateForwardPass() {
        // Arrange
        double[][] weights = {
                { 0.1, 0.4 },
                { 0.2, 0.5 }
        };

        double[] biases = { 0.5, -0.5 };

        DenseLayer layer = new DenseLayer(
                weights,
                biases);

        // Act
        double[] result = layer.forward(
                new double[] { 2.0, 3.0 });

        // Assert
        assertArrayEquals(
                new double[] { 1.3, 1.8 },
                result,
                0.000001);
    }

    @Test
    void shouldReturnCorrectDimensions() {
        double[][] weights = {
                { 1, 2, 3 },
                { 4, 5, 6 }
        };

        double[] biases = { 0, 0, 0 };

        DenseLayer layer = new DenseLayer(
                weights,
                biases);

        assertEquals(2, layer.inputSize());
        assertEquals(3, layer.outputSize());
    }

    @Test
    void shouldRejectInvalidInputDimensions() {
        DenseLayer layer = new DenseLayer(
                new double[][] {
                        { 1, 2 },
                        { 3, 4 }
                },
                new double[] { 0, 0 });

        assertThrows(
                IllegalArgumentException.class,
                () -> layer.forward(new double[] { 1 }));
    }

    @Test
    void shouldRejectInvalidWeightDimensions() {
        assertThrows(
                IllegalArgumentException.class,
                () -> new DenseLayer(
                        new double[][] {
                                { 1, 2 },
                                { 3 }
                        },
                        new double[] { 0, 0 }));
    }

    @Test
    void shouldProtectWeightsFromExternalChanges() {
        double[][] weights = { { 2.0 } };
        double[] biases = { 1.0 };

        DenseLayer layer = new DenseLayer(
                weights,
                biases);

        weights[0][0] = 100.0;
        biases[0] = 200.0;

        double[] result = layer.forward(
                new double[] { 3.0 });

        assertArrayEquals(
                new double[] { 7.0 },
                result,
                0.000001);
    }

    @Test
    void shouldApplyGeluAfterDenseLayer() {

        // Arrange
        double[][] weights = {
                { 1.0, -1.0 }
        };

        double[] biases = { 0.0, 0.0 };

        DenseLayer layer = new DenseLayer(
                weights,
                biases);

        // Act - przejście przez warstwę liniową
        double[] linearOutput = layer.forward(
                new double[] { 1.0 });

        // Act - zastosowanie funkcji aktywacji
        double[] activatedOutput = GeluActivation.apply(linearOutput);

        // Assert
        assertArrayEquals(
                new double[] { 1.0, -1.0 },
                linearOutput,
                0.000001);

        assertArrayEquals(
                new double[] {
                        0.84119199,
                        -0.15880801
                },
                activatedOutput,
                0.000001);
    }

}
