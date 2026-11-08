
package pl.bawar.jarvis.brain.embedding;

import org.junit.jupiter.api.Test;
import pl.bawar.jarvis.brain.tokenizer.CharTokenizer;

import static org.junit.jupiter.api.Assertions.*;

class EmbeddingLayerTest {

    @Test
    void shouldReturnCorrectDimensions() {
        EmbeddingLayer layer = new EmbeddingLayer(
                10, 4, 42L);

        assertEquals(10, layer.vocabularySize());
        assertEquals(4, layer.embeddingSize());
        assertEquals(4, layer.forward(5).length);
    }

    @Test
    void shouldInitializeDeterministically() {
        EmbeddingLayer first = new EmbeddingLayer(
                10, 4, 42L);

        EmbeddingLayer second = new EmbeddingLayer(
                10, 4, 42L);

        assertArrayEquals(
                first.forward(5),
                second.forward(5),
                0.0);
    }

    @Test
    void shouldKeepPaddingVectorZero() {
        EmbeddingLayer layer = new EmbeddingLayer(
                10, 3, 42L);

        assertArrayEquals(
                new double[] { 0.0, 0.0, 0.0 },
                layer.forward(0),
                0.0);
    }

    @Test
    void shouldReturnIndependentVectorCopy() {
        EmbeddingLayer layer = new EmbeddingLayer(
                10, 3, 42L);

        double[] first = layer.forward(5);
        double originalValue = first[0];

        first[0] = 999.0;

        double[] second = layer.forward(5);

        assertEquals(originalValue, second[0]);
    }

    @Test
    void shouldRejectInvalidParameters() {
        assertThrows(
                IllegalArgumentException.class,
                () -> new EmbeddingLayer(4, 8, 42L));

        assertThrows(
                IllegalArgumentException.class,
                () -> new EmbeddingLayer(10, 0, 42L));

        EmbeddingLayer layer = new EmbeddingLayer(
                10, 3, 42L);

        assertThrows(
                IllegalArgumentException.class,
                () -> layer.forward(100));
    }

    @Test
    void shouldConvertTextIntoEmbeddingMatrix() {
        // Arrange
        CharTokenizer tokenizer = new CharTokenizer("Ala ma kota");

        EmbeddingLayer layer = new EmbeddingLayer(
                tokenizer.vocabularySize(),
                8,
                42L);

        // Act
        int[] tokens = tokenizer.encode("Ala");
        double[][] embeddings = layer.forward(tokens);

        // Assert
        assertEquals(5, tokens.length);

        assertEquals(5, embeddings.length);
        assertEquals(8, embeddings[0].length);

        assertEquals("Ala", tokenizer.decode(tokens));
    }
}
