package pl.bawar.jarvis.brain.embedding;

import java.util.Random;

/** Learned positional embeddings. Each sequence position owns one trainable row. */
public final class PositionalEmbedding {
    private final double[][] weights;
    private final int maxSequenceLength;
    private final int embeddingSize;

    public PositionalEmbedding(int maxSequenceLength, int embeddingSize, long seed) {
        if (maxSequenceLength <= 0) {
            throw new IllegalArgumentException("Max sequence length must be positive");
        }
        if (embeddingSize <= 0) {
            throw new IllegalArgumentException("Embedding size must be positive");
        }
        this.maxSequenceLength = maxSequenceLength;
        this.embeddingSize = embeddingSize;
        weights = new double[maxSequenceLength][embeddingSize];
        Random random = new Random(seed);
        for (int i = 0; i < maxSequenceLength; i++) {
            for (int j = 0; j < embeddingSize; j++) {
                weights[i][j] = random.nextGaussian() * 0.02;
            }
        }
    }

    public double[][] forward(double[][] tokenEmbeddings) {
        validate(tokenEmbeddings);
        double[][] result = new double[tokenEmbeddings.length][embeddingSize];
        for (int i = 0; i < tokenEmbeddings.length; i++) {
            for (int j = 0; j < embeddingSize; j++) {
                result[i][j] = tokenEmbeddings[i][j] + weights[i][j];
            }
        }
        return result;
    }

    /** dLoss/dPositionalWeights. Unused positions have zero gradients. */
    public double[][] backward(double[][] outputGradients) {
        validate(outputGradients);
        double[][] gradients = new double[maxSequenceLength][embeddingSize];
        for (int i = 0; i < outputGradients.length; i++) {
            System.arraycopy(outputGradients[i], 0, gradients[i], 0, embeddingSize);
        }
        return gradients;
    }

    /** Addition has derivative 1: gradient to token embeddings equals dOutput. */
    public double[][] inputGradient(double[][] outputGradients) {
        validate(outputGradients);
        double[][] gradients = new double[outputGradients.length][embeddingSize];
        for (int i = 0; i < outputGradients.length; i++) {
            System.arraycopy(outputGradients[i], 0, gradients[i], 0, embeddingSize);
        }
        return gradients;
    }

    public double[][] weightsCopy() {
        double[][] copy = new double[maxSequenceLength][];
        for (int i = 0; i < maxSequenceLength; i++) {
            copy[i] = weights[i].clone();
        }
        return copy;
    }

    public void replaceWeights(double[][] updated) {
        if (updated == null || updated.length != maxSequenceLength) {
            throw new IllegalArgumentException("Invalid positional table height");
        }
        for (double[] row : updated) {
            if (row == null || row.length != embeddingSize) {
                throw new IllegalArgumentException("Invalid positional table width");
            }
            for (double value : row) {
                if (!Double.isFinite(value)) {
                    throw new IllegalArgumentException("Positional weights must be finite");
                }
            }
        }
        for (int i = 0; i < maxSequenceLength; i++) {
            System.arraycopy(updated[i], 0, weights[i], 0, embeddingSize);
        }
    }

    private void validate(double[][] matrix) {
        if (matrix == null || matrix.length == 0 || matrix.length > maxSequenceLength) {
            throw new IllegalArgumentException("Invalid sequence length");
        }
        for (double[] row : matrix) {
            if (row == null || row.length != embeddingSize) {
                throw new IllegalArgumentException("Invalid embedding dimensions");
            }
            for (double value : row) {
                if (!Double.isFinite(value)) {
                    throw new IllegalArgumentException("Embedding values must be finite");
                }
            }
        }
    }

    public int maxSequenceLength() { return maxSequenceLength; }
    public int embeddingSize() { return embeddingSize; }
}
