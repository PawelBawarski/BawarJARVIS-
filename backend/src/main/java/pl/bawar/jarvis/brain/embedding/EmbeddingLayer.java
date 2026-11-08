package pl.bawar.jarvis.brain.embedding;

import java.util.Arrays;
import java.util.Random;

/** Trainable character-token lookup table. Token 0 (PAD) stays zero. */
public final class EmbeddingLayer {
    private final double[][] weights;
    private final int vocabularySize;
    private final int embeddingSize;

    public EmbeddingLayer(int vocabularySize, int embeddingSize, long seed) {
        if (vocabularySize <= 4) {
            throw new IllegalArgumentException("Vocabulary must include character tokens");
        }
        if (embeddingSize <= 0) {
            throw new IllegalArgumentException("Embedding size must be positive");
        }
        this.vocabularySize = vocabularySize;
        this.embeddingSize = embeddingSize;
        this.weights = new double[vocabularySize][embeddingSize];
        Random random = new Random(seed);
        for (int i = 1; i < vocabularySize; i++) {
            for (int j = 0; j < embeddingSize; j++) {
                weights[i][j] = random.nextGaussian() * 0.02;
            }
        }
    }

    public double[] forward(int tokenId) {
        if (tokenId < 0 || tokenId >= vocabularySize) {
            throw new IllegalArgumentException("Invalid token ID: " + tokenId);
        }
        return Arrays.copyOf(weights[tokenId], embeddingSize);
    }

    public double[][] forward(int[] tokenIds) {
        if (tokenIds == null || tokenIds.length == 0) {
            throw new IllegalArgumentException("Token IDs cannot be null or empty");
        }
        double[][] result = new double[tokenIds.length][embeddingSize];
        for (int i = 0; i < tokenIds.length; i++) {
            result[i] = forward(tokenIds[i]);
        }
        return result;
    }

    /** dLoss/dWeights: repeated token IDs accumulate into the same row. */
    public double[][] backward(int[] tokenIds, double[][] outputGradients) {
        if (tokenIds == null || outputGradients == null || tokenIds.length == 0
                || tokenIds.length != outputGradients.length) {
            throw new IllegalArgumentException("Token/gradient sequence mismatch");
        }
        double[][] gradients = new double[vocabularySize][embeddingSize];
        for (int t = 0; t < tokenIds.length; t++) {
            int tokenId = tokenIds[t];
            if (tokenId < 0 || tokenId >= vocabularySize) {
                throw new IllegalArgumentException("Invalid token ID: " + tokenId);
            }
            if (outputGradients[t] == null || outputGradients[t].length != embeddingSize) {
                throw new IllegalArgumentException("Invalid embedding gradient width");
            }
            for (int d = 0; d < embeddingSize; d++) {
                double value = outputGradients[t][d];
                if (!Double.isFinite(value)) {
                    throw new IllegalArgumentException("Embedding gradient must be finite");
                }
                if (tokenId != 0) { // PAD is deliberately frozen.
                    gradients[tokenId][d] += value;
                }
            }
        }
        return gradients;
    }

    /** Defensive snapshot for a future optimizer; does not expose internal arrays. */
    public double[][] weightsCopy() {
        double[][] copy = new double[vocabularySize][];
        for (int i = 0; i < vocabularySize; i++) {
            copy[i] = weights[i].clone();
        }
        return copy;
    }

    /** Apply a separately computed parameter table, keeping PAD frozen. */
    public void replaceWeights(double[][] updated) {
        validateWeights(updated);
        for (int i = 1; i < vocabularySize; i++) {
            System.arraycopy(updated[i], 0, weights[i], 0, embeddingSize);
        }
        Arrays.fill(weights[0], 0.0);
    }

    private void validateWeights(double[][] updated) {
        if (updated == null || updated.length != vocabularySize) {
            throw new IllegalArgumentException("Invalid embedding table height");
        }
        for (double[] row : updated) {
            if (row == null || row.length != embeddingSize) {
                throw new IllegalArgumentException("Invalid embedding table width");
            }
            for (double value : row) {
                if (!Double.isFinite(value)) {
                    throw new IllegalArgumentException("Embedding weights must be finite");
                }
            }
        }
    }

    public int vocabularySize() { return vocabularySize; }
    public int embeddingSize() { return embeddingSize; }
}
