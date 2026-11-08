
package pl.bawar.jarvis.brain.embedding;

import java.util.Arrays;
import java.util.Random;

public final class EmbeddingLayer {

    private final double[][] weights;

    private final int vocabularySize;
    private final int embeddingSize;

    public EmbeddingLayer(
            int vocabularySize,
            int embeddingSize,
            long seed) {
        if (vocabularySize <= 4) {
            throw new IllegalArgumentException(
                    "Vocabulary must include character tokens");
        }

        if (embeddingSize <= 0) {
            throw new IllegalArgumentException(
                    "Embedding size must be positive");
        }

        this.vocabularySize = vocabularySize;
        this.embeddingSize = embeddingSize;

        this.weights = new double[vocabularySize][embeddingSize];

        Random random = new Random(seed);

        // ID = 0 (PAD) pozostaje wektorem zerowym.
        for (int i = 1; i < vocabularySize; i++) {
            for (int j = 0; j < embeddingSize; j++) {
                weights[i][j] = random.nextGaussian() * 0.02;
            }
        }
    }

    public double[] forward(int tokenId) {

        if (tokenId < 0 || tokenId >= vocabularySize) {
            throw new IllegalArgumentException(
                    "Invalid token ID: " + tokenId);
        }

        // Zwracamy kopię wektora.
        return Arrays.copyOf(
                weights[tokenId],
                embeddingSize);
    }

    public double[][] forward(int[] tokenIds) {

        if (tokenIds == null || tokenIds.length == 0) {
            throw new IllegalArgumentException(
                    "Token IDs cannot be null or empty");
        }

        double[][] result = new double[tokenIds.length][embeddingSize];

        for (int i = 0; i < tokenIds.length; i++) {
            result[i] = forward(tokenIds[i]);
        }

        return result;
    }

    public int vocabularySize() {
        return vocabularySize;
    }

    public int embeddingSize() {
        return embeddingSize;
    }
}
