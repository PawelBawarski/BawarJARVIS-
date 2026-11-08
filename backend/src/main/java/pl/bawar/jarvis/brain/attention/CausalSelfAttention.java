package pl.bawar.jarvis.brain.attention;

import pl.bawar.jarvis.brain.layers.DenseGradients;
import pl.bawar.jarvis.brain.layers.DenseLayer;
import pl.bawar.jarvis.brain.math.MatrixOps;

/** Single-head, causal scaled dot-product attention with trainable Q/K/V Dense projections. */
public final class CausalSelfAttention {

    private final DenseLayer queryProjection;
    private final DenseLayer keyProjection;
    private final DenseLayer valueProjection;
    private final int embeddingSize;
    private final double scale;

    public CausalSelfAttention(
            DenseLayer queryProjection,
            DenseLayer keyProjection,
            DenseLayer valueProjection) {
        if (queryProjection == null || keyProjection == null || valueProjection == null) {
            throw new IllegalArgumentException("Attention projections cannot be null");
        }
        int size = queryProjection.inputSize();
        if (queryProjection.outputSize() != size
                || keyProjection.inputSize() != size || keyProjection.outputSize() != size
                || valueProjection.inputSize() != size || valueProjection.outputSize() != size) {
            throw new IllegalArgumentException("Attention projection dimensions must match");
        }
        this.queryProjection = queryProjection;
        this.keyProjection = keyProjection;
        this.valueProjection = valueProjection;
        this.embeddingSize = size;
        this.scale = 1.0 / Math.sqrt(size);
    }

    /** Original forward API, preserved for MultiHeadAttention and TransformerBlock. */
    public double[][] forward(double[][] input) {
        validateTokens(input, "Attention input");
        int sequenceLength = input.length;
        double[][] queries = project(input, queryProjection);
        double[][] keys = project(input, keyProjection);
        double[][] values = project(input, valueProjection);
        double[][] output = new double[sequenceLength][embeddingSize];

        for (int i = 0; i < sequenceLength; i++) {
            double[] alpha = maskedWeights(queries[i], keys, i);
            for (int j = 0; j <= i; j++) { // CAUSAL: never look ahead
                for (int k = 0; k < embeddingSize; k++) {
                    output[i][k] += alpha[j] * values[j][k];
                }
            }
        }
        return output;
    }

    /**
     * Backpropagation for a scalar loss L, given dOutput[t][d] = dL/dY[t][d].
     * Recomputes forward intermediates (educational version, no mutable cache).
     * All Q/K/V projection parameter gradients are SUMMED across the sequence.
     * This method does not modify model parameters.
     */
    public CausalAttentionGradients backward(double[][] input, double[][] dOutput) {
        validateTokens(input, "Attention input");
        validateTokens(dOutput, "Attention output gradient");
        if (input.length != dOutput.length) {
            throw new IllegalArgumentException("Gradient sequence length must match input");
        }

        int tokens = input.length;
        double[][] q = project(input, queryProjection);
        double[][] k = project(input, keyProjection);
        double[][] v = project(input, valueProjection);

        double[][] dQ = new double[tokens][embeddingSize];
        double[][] dK = new double[tokens][embeddingSize];
        double[][] dV = new double[tokens][embeddingSize];

        for (int i = 0; i < tokens; i++) {
            // Softmax is computed ONLY on keys 0..i: causal mask holds in backward.
            double[] alpha = maskedWeights(q[i], k, i);
            double[] dAlpha = new double[i + 1];

            // Y_i = sum_j alpha_ij * V_j
            for (int j = 0; j <= i; j++) {
                for (int dim = 0; dim < embeddingSize; dim++) {
                    dV[j][dim] += alpha[j] * dOutput[i][dim];
                    dAlpha[j] += dOutput[i][dim] * v[j][dim];
                }
            }

            // Backward of softmax: dScore_j = alpha_j * (dAlpha_j - dot(alpha, dAlpha)).
            double weightedSum = 0.0;
            for (int j = 0; j <= i; j++) {
                weightedSum += alpha[j] * dAlpha[j];
            }
            for (int j = 0; j <= i; j++) {
                double dScore = alpha[j] * (dAlpha[j] - weightedSum);
                for (int dim = 0; dim < embeddingSize; dim++) {
                    dQ[i][dim] += scale * dScore * k[j][dim];
                    dK[j][dim] += scale * dScore * q[i][dim];
                }
            }
        }

        double[][] dInput = new double[tokens][embeddingSize];
        double[][] dWq = new double[embeddingSize][embeddingSize];
        double[][] dWk = new double[embeddingSize][embeddingSize];
        double[][] dWv = new double[embeddingSize][embeddingSize];
        double[] dBq = new double[embeddingSize];
        double[] dBk = new double[embeddingSize];
        double[] dBv = new double[embeddingSize];

        // Shared Q/K/V weights -> sum parameter gradients over ALL tokens.
        for (int i = 0; i < tokens; i++) {
            DenseGradients qGrad = queryProjection.backward(input[i], dQ[i]);
            DenseGradients kGrad = keyProjection.backward(input[i], dK[i]);
            DenseGradients vGrad = valueProjection.backward(input[i], dV[i]);

            addMatrix(dWq, qGrad.weightGradients());
            addMatrix(dWk, kGrad.weightGradients());
            addMatrix(dWv, vGrad.weightGradients());
            addVector(dBq, qGrad.biasGradients());
            addVector(dBk, kGrad.biasGradients());
            addVector(dBv, vGrad.biasGradients());

            for (int dim = 0; dim < embeddingSize; dim++) {
                dInput[i][dim] = qGrad.inputGradient()[dim]
                        + kGrad.inputGradient()[dim]
                        + vGrad.inputGradient()[dim];
            }
        }

        return new CausalAttentionGradients(
                dInput,
                new AttentionProjectionGradients(dWq, dBq),
                new AttentionProjectionGradients(dWk, dBk),
                new AttentionProjectionGradients(dWv, dBv));
    }

    private double[][] project(double[][] input, DenseLayer projection) {
        double[][] output = new double[input.length][];
        for (int i = 0; i < input.length; i++) {
            output[i] = projection.forward(input[i]);
        }
        return output;
    }

    private double[] maskedWeights(double[] query, double[][] keys, int position) {
        double[] scores = new double[position + 1];
        for (int j = 0; j <= position; j++) {
            double dot = 0.0;
            for (int dim = 0; dim < embeddingSize; dim++) {
                dot += query[dim] * keys[j][dim];
            }
            scores[j] = dot * scale;
        }
        return MatrixOps.softmax(scores);
    }

    private void validateTokens(double[][] tokens, String label) {
        if (tokens == null || tokens.length == 0) {
            throw new IllegalArgumentException(label + " cannot be null or empty");
        }
        for (double[] row : tokens) {
            if (row == null || row.length != embeddingSize) {
                throw new IllegalArgumentException(label + " dimensions are invalid");
            }
            for (double value : row) {
                if (!Double.isFinite(value)) {
                    throw new IllegalArgumentException(label + " must be finite");
                }
            }
        }
    }

    private static void addMatrix(double[][] result, double[][] next) {
        for (int i = 0; i < result.length; i++) {
            for (int j = 0; j < result[i].length; j++) {
                result[i][j] += next[i][j];
            }
        }
    }

    private static void addVector(double[] result, double[] next) {
        for (int i = 0; i < result.length; i++) {
            result[i] += next[i];
        }
    }

    public int embeddingSize() {
        return embeddingSize;
    }

    public DenseLayer queryProjection() { return queryProjection; }
    public DenseLayer keyProjection() { return keyProjection; }
    public DenseLayer valueProjection() { return valueProjection; }

}
