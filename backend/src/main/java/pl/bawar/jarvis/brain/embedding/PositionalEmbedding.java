
package pl.bawar.jarvis.brain.embedding;

import java.util.Random;

public final class PositionalEmbedding {

    private final double[][] weights;
    private final int maxSequenceLength;
    private final int embeddingSize;

    public PositionalEmbedding(
            int maxSequenceLength,
            int embeddingSize,
            long seed) {
        if (maxSequenceLength <= 0) {
            throw new IllegalArgumentException(
                    "Max sequence length must be positive");
        }

        if (embeddingSize <= 0) {
            throw new IllegalArgumentException(
                    "Embedding size must be positive");
        }

        this.maxSequenceLength = maxSequenceLength;
        this.embeddingSize = embeddingSize;

        this.weights = new double[maxSequenceLength][embeddingSize];

        Random random = new Random(seed);

        // Każda pozycja otrzymuje własny wektor.
        for (int i = 0; i < maxSequenceLength; i++) {
            for (int j = 0; j < embeddingSize; j++) {
                weights[i][j] = random.nextGaussian() * 0.02;
            }
        }
    }

    public double[][] forward(double[][] tokenEmbeddings) {

        if (tokenEmbeddings == null ||
                tokenEmbeddings.length == 0) {
            throw new IllegalArgumentException(
                    "Token embeddings cannot be null or empty");
        }

        if (tokenEmbeddings.length > maxSequenceLength) {
            throw new IllegalArgumentException(
                    "Sequence exceeds maximum length");
        }

        double[][] result = new double[tokenEmbeddings.length][embeddingSize];

        for (int i = 0; i < tokenEmbeddings.length; i++) {

            double[] token = tokenEmbeddings[i];

            if (token == null ||
                    token.length != embeddingSize) {
                throw new IllegalArgumentException(
                        "Invalid embedding dimensions");
            }

            for (int j = 0; j < embeddingSize; j++) {

                if (!Double.isFinite(token[j])) {
                    throw new IllegalArgumentException(
                            "Embedding values must be finite");
                }

                // Embedding tokenu + embedding pozycji.
                result[i][j] = token[j] + weights[i][j];
            }
        }

        return result;
    }

    public int maxSequenceLength() {
        return maxSequenceLength;
    }

    public int embeddingSize() {
        return embeddingSize;
    }
}
