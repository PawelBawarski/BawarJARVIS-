
package pl.bawar.jarvis.brain.normalization;

import java.util.Arrays;

public final class LayerNormalization {

    private final int embeddingSize;
    private final double epsilon;

    private final double[] gamma;
    private final double[] beta;

    public LayerNormalization(
            int embeddingSize,
            double epsilon) {
        if (embeddingSize <= 0) {
            throw new IllegalArgumentException(
                    "Embedding size must be positive");
        }

        if (!Double.isFinite(epsilon) || epsilon <= 0) {
            throw new IllegalArgumentException(
                    "Epsilon must be finite and positive");
        }

        this.embeddingSize = embeddingSize;
        this.epsilon = epsilon;

        this.gamma = new double[embeddingSize];
        this.beta = new double[embeddingSize];

        // Początkowo gamma = 1, beta = 0.
        Arrays.fill(gamma, 1.0);
    }

    public double[] forward(double[] input) {

        if (input == null ||
                input.length != embeddingSize) {
            throw new IllegalArgumentException(
                    "Invalid input dimensions");
        }

        // Krok 1: Obliczamy średnią.
        double mean = 0.0;

        for (double value : input) {
            if (!Double.isFinite(value)) {
                throw new IllegalArgumentException(
                        "Input values must be finite");
            }

            mean += value;
        }

        mean /= embeddingSize;

        // Krok 2: Obliczamy wariancję.
        double variance = 0.0;

        for (double value : input) {
            double difference = value - mean;
            variance += difference * difference;
        }

        variance /= embeddingSize;

        // Krok 3: Normalizacja oraz gamma i beta.
        double denominator = Math.sqrt(variance + epsilon);

        double[] output = new double[embeddingSize];

        for (int i = 0; i < embeddingSize; i++) {
            double normalized = (input[i] - mean) / denominator;

            output[i] = gamma[i] * normalized + beta[i];
        }

        return output;
    }

    public double[][] forward(double[][] input) {

        if (input == null || input.length == 0) {
            throw new IllegalArgumentException(
                    "Input matrix cannot be null or empty");
        }

        double[][] output = new double[input.length][embeddingSize];

        for (int i = 0; i < input.length; i++) {
            output[i] = forward(input[i]);
        }

        return output;
    }

    public int embeddingSize() {
        return embeddingSize;
    }
}
