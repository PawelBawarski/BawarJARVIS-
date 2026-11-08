
package pl.bawar.jarvis.brain.layers;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class FeedForwardNetworkTest {

    private static final double DELTA = 0.000001;

    private FeedForwardNetwork createNetwork() {

        // DenseLayer 1: 2 wejścia -> 3 neurony.
        DenseLayer inputLayer = new DenseLayer(
                new double[][] {
                        { 1.0, 0.0, 1.0 },
                        { 0.0, 1.0, 1.0 }
                },
                new double[] { 0.0, 0.0, 0.0 });

        // DenseLayer 2: 3 wejścia -> 2 neurony.
        DenseLayer outputLayer = new DenseLayer(
                new double[][] {
                        { 1.0, 0.0 },
                        { 0.0, 1.0 },
                        { 1.0, 1.0 }
                },
                new double[] { 0.5, -0.5 });

        return new FeedForwardNetwork(
                inputLayer,
                outputLayer);
    }

    @Test
    void shouldCalculateForwardPass() {

        // Arrange
        FeedForwardNetwork network = createNetwork();

        // Act
        double[] result = network.forward(
                new double[] { 1.0, -1.0 });

        // Assert
        assertArrayEquals(
                new double[] {
                        1.34119199,
                        -0.65880801
                },
                result,
                DELTA);
    }

    @Test
    void shouldReturnCorrectDimensions() {

        FeedForwardNetwork network = createNetwork();

        assertEquals(2, network.embeddingSize());
        assertEquals(3, network.hiddenSize());
    }

    @Test
    void shouldProcessMultipleTokens() {

        FeedForwardNetwork network = createNetwork();

        double[][] input = {
                { 1.0, -1.0 },
                { 0.0, 0.0 }
        };

        double[][] result = network.forward(input);

        assertEquals(2, result.length);

        assertArrayEquals(
                new double[] { 1.34119199, -0.65880801 },
                result[0],
                DELTA);

        assertArrayEquals(
                new double[] { 0.5, -0.5 },
                result[1],
                DELTA);
    }

    @Test
    void shouldProcessTokensIndependently() {

        FeedForwardNetwork network = createNetwork();

        double[][] firstInput = {
                { 1.0, -1.0 },
                { 2.0, 2.0 }
        };

        double[][] changedSecondToken = {
                { 1.0, -1.0 },
                { 100.0, -100.0 }
        };

        double[][] firstResult = network.forward(firstInput);

        double[][] secondResult = network.forward(changedSecondToken);

        // Zmiana drugiego tokenu nie wpływa
        // na wynik pierwszego.
        assertArrayEquals(
                firstResult[0],
                secondResult[0],
                DELTA);
    }

    @Test
    void shouldRejectInvalidLayerDimensions() {

        DenseLayer first = new DenseLayer(
                new double[][] {
                        { 1.0, 2.0, 3.0 },
                        { 4.0, 5.0, 6.0 }
                },
                new double[] { 0.0, 0.0, 0.0 });

        // Błędna druga warstwa: 2 -> 2.
        // Powinna przyjmować 3 wartości.
        DenseLayer wrongSecond = new DenseLayer(
                new double[][] {
                        { 1.0, 0.0 },
                        { 0.0, 1.0 }
                },
                new double[] { 0.0, 0.0 });

        assertThrows(
                IllegalArgumentException.class,
                () -> new FeedForwardNetwork(
                        first,
                        wrongSecond));

        assertThrows(
                IllegalArgumentException.class,
                () -> new FeedForwardNetwork(null, wrongSecond));
    }

    @Test
    void shouldRejectInvalidInput() {

        FeedForwardNetwork network = createNetwork();

        assertThrows(
                IllegalArgumentException.class,
                () -> network.forward((double[]) null));

        assertThrows(
                IllegalArgumentException.class,
                () -> network.forward(new double[] { 1.0 }));

        assertThrows(
                IllegalArgumentException.class,
                () -> network.forward(
                        new double[] { Double.NaN, 1.0 }));

        assertThrows(
                IllegalArgumentException.class,
                () -> network.forward(new double[][] {}));
    }

    @Test
    void shouldNotModifyInput() {

        FeedForwardNetwork network = createNetwork();

        double[][] input = {
                { 1.0, 2.0 },
                { 3.0, 4.0 }
        };

        network.forward(input);

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
