package pl.bawar.jarvis.brain.normalization;

import java.util.Arrays;

public final class LayerNormalization {

    private final int embeddingSize;
    private final double epsilon;
    private final double[] gamma;
    private final double[] beta;

    public LayerNormalization(int embeddingSize, double epsilon) {
        if (embeddingSize <= 0) {
            throw new IllegalArgumentException("Embedding size must be positive");
        }
        if (!Double.isFinite(epsilon) || epsilon <= 0) {
            throw new IllegalArgumentException("Epsilon must be finite and positive");
        }
        this.embeddingSize = embeddingSize;
        this.epsilon = epsilon;
        this.gamma = new double[embeddingSize];
        this.beta = new double[embeddingSize];
        Arrays.fill(gamma, 1.0);
    }

    public double[] forward(double[] input) {
        validateVector(input, "Input");

        double mean = 0.0;
        for (double value : input) mean += value;
        mean /= embeddingSize;

        double variance = 0.0;
        for (double value : input) {
            double centered = value - mean;
            variance += centered * centered;
        }
        variance /= embeddingSize;
        double invStd = 1.0 / Math.sqrt(variance + epsilon);

        double[] output = new double[embeddingSize];
        for (int i = 0; i < embeddingSize; i++) {
            output[i] = gamma[i] * ((input[i] - mean) * invStd) + beta[i];
        }
        return output;
    }

    public double[][] forward(double[][] input) {
        if (input == null || input.length == 0) {
            throw new IllegalArgumentException("Input matrix cannot be null or empty");
        }
        double[][] output = new double[input.length][embeddingSize];
        for (int i = 0; i < input.length; i++) output[i] = forward(input[i]);
        return output;
    }

    public int embeddingSize() { return embeddingSize; }

    /** Kopie parametrów, aby kod zewnętrzny nie modyfikował stanu przypadkiem. */
    public double[] gamma() { return gamma.clone(); }
    public double[] beta() { return beta.clone(); }

    /** Przydatne w kolejnym etapie: optimizer aktualizuje kopie i ustawia parametry. */
    public void setAffineParameters(double[] newGamma, double[] newBeta) {
        validateVector(newGamma, "Gamma");
        validateVector(newBeta, "Beta");
        System.arraycopy(newGamma, 0, gamma, 0, embeddingSize);
        System.arraycopy(newBeta, 0, beta, 0, embeddingSize);
    }

    /** Backpropagation przez normalizację pojedynczego tokenu. */
    public LayerNormGradients backward(double[] input, double[] outputGradient) {
        validateVector(input, "Input");
        validateVector(outputGradient, "Output gradient");

        int n = embeddingSize;
        double mean = 0.0;
        for (double x : input) mean += x;
        mean /= n;

        double variance = 0.0;
        for (double x : input) {
            double centered = x - mean;
            variance += centered * centered;
        }
        variance /= n;
        double invStd = 1.0 / Math.sqrt(variance + epsilon);

        double[] normalized = new double[n];
        double[] gammaGradient = new double[n];
        double[] betaGradient = outputGradient.clone();
        double[] normalizedGradient = new double[n];
        double sumDNorm = 0.0;
        double sumDNormTimesNorm = 0.0;

        for (int i = 0; i < n; i++) {
            normalized[i] = (input[i] - mean) * invStd;
            gammaGradient[i] = outputGradient[i] * normalized[i];
            normalizedGradient[i] = outputGradient[i] * gamma[i];
            sumDNorm += normalizedGradient[i];
            sumDNormTimesNorm += normalizedGradient[i] * normalized[i];
        }

        double[] inputGradient = new double[n];
        for (int i = 0; i < n; i++) {
            inputGradient[i] = invStd * (
                    normalizedGradient[i] - sumDNorm / n
                            - normalized[i] * sumDNormTimesNorm / n
            );
        }
        return new LayerNormGradients(inputGradient, gammaGradient, betaGradient);
    }

    private void validateVector(double[] values, String name) {
        if (values == null || values.length != embeddingSize) {
            throw new IllegalArgumentException(name + " has invalid dimensions");
        }
        for (double value : values) {
            if (!Double.isFinite(value)) {
                throw new IllegalArgumentException(name + " must contain finite numbers");
            }
        }
    }
}
