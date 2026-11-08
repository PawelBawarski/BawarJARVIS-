
package pl.bawar.jarvis.brain.embedding;

import org.junit.jupiter.api.Test;
import pl.bawar.jarvis.brain.tokenizer.CharTokenizer;

import static org.junit.jupiter.api.Assertions.*;

class PositionalEmbeddingTest {

    private static final double DELTA = 0.000001;

    @Test
    void shouldReturnCorrectDimensions() {

        PositionalEmbedding layer = new PositionalEmbedding(128, 8, 42L);

        assertEquals(128, layer.maxSequenceLength());
        assertEquals(8, layer.embeddingSize());
    }

    @Test
    void shouldAddPositionToTokenEmbedding() {

        PositionalEmbedding layer = new PositionalEmbedding(10, 3, 42L);

        double[][] zeros = {
                { 0.0, 0.0, 0.0 },
                { 0.0, 0.0, 0.0 }
        };

        // Odczytujemy same wektory pozycyjne.
        double[][] positions = layer.forward(zeros);

        double[][] tokens = {
                { 1.0, 2.0, 3.0 },
                { 4.0, 5.0, 6.0 }
        };

        double[][] result = layer.forward(tokens);

        for (int i = 0; i < tokens.length; i++) {
            for (int j = 0; j < tokens[i].length; j++) {

                assertEquals(
                        tokens[i][j] + positions[i][j],
                        result[i][j],
                        DELTA);
            }
        }
    }

    @Test
    void shouldUseDifferentVectorsForDifferentPositions() {

        PositionalEmbedding layer = new PositionalEmbedding(10, 4, 42L);

        double[][] zeros = {
                { 0.0, 0.0, 0.0, 0.0 },
                { 0.0, 0.0, 0.0, 0.0 }
        };

        double[][] result = layer.forward(zeros);

        assertFalse(
                java.util.Arrays.equals(
                        result[0],
                        result[1]));
    }

    @Test
    void shouldInitializeDeterministically() {

        PositionalEmbedding first = new PositionalEmbedding(10, 4, 42L);

        PositionalEmbedding second = new PositionalEmbedding(10, 4, 42L);

        double[][] input = {
                { 1.0, 2.0, 3.0, 4.0 }
        };

        assertArrayEquals(
                first.forward(input)[0],
                second.forward(input)[0],
                DELTA);
    }

    @Test
    void shouldNotModifyTokenEmbeddings() {

        PositionalEmbedding layer = new PositionalEmbedding(10, 2, 42L);

        double[][] input = {
                { 1.0, 2.0 },
                { 3.0, 4.0 }
        };

        layer.forward(input);

        assertArrayEquals(
                new double[] { 1.0, 2.0 },
                input[0],
                DELTA);

        assertArrayEquals(
                new double[] { 3.0, 4.0 },
                input[1],
                DELTA);
    }

    @Test
    void shouldRejectInvalidDimensions() {

        PositionalEmbedding layer = new PositionalEmbedding(2, 3, 42L);

        assertThrows(
                IllegalArgumentException.class,
                () -> layer.forward(new double[][] {
                        { 1.0, 2.0 }
                }));

        assertThrows(
                IllegalArgumentException.class,
                () -> layer.forward(new double[][] {
                        { 1.0, 2.0, 3.0 },
                        { 4.0, 5.0, 6.0 },
                        { 7.0, 8.0, 9.0 }
                }));

        assertThrows(
                IllegalArgumentException.class,
                () -> layer.forward(null));
    }

    @Test
    void shouldConnectTokenizerAndEmbeddings() {

        // Arrange
        CharTokenizer tokenizer = new CharTokenizer("Ala ma kota");

        EmbeddingLayer tokenLayer = new EmbeddingLayer(
                tokenizer.vocabularySize(),
                8,
                42L);

        PositionalEmbedding positionLayer = new PositionalEmbedding(128, 8, 123L);

        // Act
        int[] tokens = tokenizer.encode("Ala");

        double[][] tokenEmbeddings = tokenLayer.forward(tokens);

        double[][] output = positionLayer.forward(tokenEmbeddings);

        // Assert
        assertEquals(5, output.length);
        assertEquals(8, output[0].length);

        assertEquals("Ala", tokenizer.decode(tokens));
    }
}
