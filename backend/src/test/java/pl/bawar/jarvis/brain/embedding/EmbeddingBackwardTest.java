package pl.bawar.jarvis.brain.embedding;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class EmbeddingBackwardTest {
    @Test
    void shouldAccumulateRepeatedTokenGradientsAndFreezePadding() {
        EmbeddingLayer embeddings = new EmbeddingLayer(7, 2, 42L);
        double[][] dWeights = embeddings.backward(
                new int[]{4, 4, 0, 2},
                new double[][]{{1, 2}, {3, 4}, {6, 7}, {-1, 5}});
        assertArrayEquals(new double[]{4, 6}, dWeights[4], 1e-12);
        assertArrayEquals(new double[]{0, 0}, dWeights[0], 1e-12);
        assertArrayEquals(new double[]{-1, 5}, dWeights[2], 1e-12);
        assertArrayEquals(new double[]{0, 0}, dWeights[5], 1e-12);
    }

    @Test
    void shouldNotExposeInternalWeights() {
        EmbeddingLayer embeddings = new EmbeddingLayer(7, 2, 42L);
        double initial = embeddings.forward(4)[0];
        embeddings.weightsCopy()[4][0] = 999;
        assertEquals(initial, embeddings.forward(4)[0]);
    }

    @Test
    void shouldReplaceWeightsButKeepPadZero() {
        EmbeddingLayer embeddings = new EmbeddingLayer(7, 2, 42L);
        double[][] values = embeddings.weightsCopy();
        values[0][0] = 999;
        values[4][0] = 0.123;
        embeddings.replaceWeights(values);
        assertEquals(0, embeddings.forward(0)[0]);
        assertEquals(0.123, embeddings.forward(4)[0]);
    }

    @Test
    void positionalEmbeddingShouldReturnGradientsForUsedPositions() {
        PositionalEmbedding positions = new PositionalEmbedding(5, 2, 42L);
        double[][] dOutput = {{1.5, -2.0}, {3.0, 4.0}};
        double[][] dPositions = positions.backward(dOutput);
        assertArrayEquals(dOutput[0], dPositions[0]);
        assertArrayEquals(dOutput[1], dPositions[1]);
        assertArrayEquals(new double[]{0, 0}, dPositions[3]);
        assertArrayEquals(dOutput[0], positions.inputGradient(dOutput)[0]);
    }

    @Test
    void positionalGradientShouldMatchFiniteDifference() {
        PositionalEmbedding positions = new PositionalEmbedding(4, 2, 42L);
        double[][] input = {{0.5, 0.2}, {-0.8, 1.2}};
        double[][] gradient = {{0.1, 0.5}, {-0.25, 0.75}};
        double[][] analytical = positions.backward(gradient);
        double[][] original = positions.weightsCopy();
        double epsilon = 1e-6;
        for (int t = 0; t < input.length; t++) {
            for (int d = 0; d < 2; d++) {
                double[][] plus = copy(original);
                double[][] minus = copy(original);
                plus[t][d] += epsilon;
                minus[t][d] -= epsilon;
                positions.replaceWeights(plus);
                double positive = dot(positions.forward(input), gradient);
                positions.replaceWeights(minus);
                double negative = dot(positions.forward(input), gradient);
                double numerical = (positive - negative) / (2 * epsilon);
                assertEquals(numerical, analytical[t][d], 1e-8);
            }
        }
        positions.replaceWeights(original);
    }

    @Test
    void tokenGradientShouldMatchFiniteDifferenceWithRepeatedIds() {
        EmbeddingLayer embeddings = new EmbeddingLayer(7, 2, 42L);
        int[] ids = {4, 2, 4};
        double[][] upstream = {{1.2, -0.4}, {0.5, 0.8}, {-0.3, 1.1}};
        double[][] analytical = embeddings.backward(ids, upstream);
        double[][] original = embeddings.weightsCopy();
        double epsilon = 1e-6;
        for (int tokenId : new int[]{2, 4}) {
            for (int d = 0; d < 2; d++) {
                double[][] plus = copy(original);
                double[][] minus = copy(original);
                plus[tokenId][d] += epsilon;
                minus[tokenId][d] -= epsilon;
                embeddings.replaceWeights(plus);
                double positive = dot(embeddings.forward(ids), upstream);
                embeddings.replaceWeights(minus);
                double negative = dot(embeddings.forward(ids), upstream);
                assertEquals((positive - negative) / (2 * epsilon),
                        analytical[tokenId][d], 1e-8);
            }
        }
        embeddings.replaceWeights(original);
    }

    @Test
    void shouldRejectInvalidGradients() {
        EmbeddingLayer embeddings = new EmbeddingLayer(7, 2, 42L);
        assertThrows(IllegalArgumentException.class,
                () -> embeddings.backward(new int[]{4}, new double[][]{{Double.NaN, 0}}));
        assertThrows(IllegalArgumentException.class,
                () -> embeddings.backward(new int[]{50}, new double[][]{{1, 2}}));
        PositionalEmbedding positions = new PositionalEmbedding(5, 2, 42L);
        assertThrows(IllegalArgumentException.class,
                () -> positions.backward(new double[][]{{1}}));
    }

    private static double dot(double[][] a, double[][] b) {
        double total = 0;
        for (int i = 0; i < a.length; i++) {
            for (int j = 0; j < a[i].length; j++) total += a[i][j] * b[i][j];
        }
        return total;
    }
    private static double[][] copy(double[][] source) {
        double[][] copy = new double[source.length][];
        for (int i = 0; i < source.length; i++) copy[i] = source[i].clone();
        return copy;
    }
}
