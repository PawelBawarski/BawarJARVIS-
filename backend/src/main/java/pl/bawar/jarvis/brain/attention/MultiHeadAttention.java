package pl.bawar.jarvis.brain.attention;

import pl.bawar.jarvis.brain.layers.DenseGradients;
import pl.bawar.jarvis.brain.layers.DenseLayer;

import java.util.ArrayList;
import java.util.List;

/** Educational Multi-Head Attention: h full-size causal heads + output projection. */
public final class MultiHeadAttention {

    private final List<CausalSelfAttention> heads;
    private final DenseLayer outputProjection;
    private final int embeddingSize;
    private final int headCount;

    public MultiHeadAttention(
            List<CausalSelfAttention> heads,
            DenseLayer outputProjection) {
        if (heads == null || heads.isEmpty()) {
            throw new IllegalArgumentException("At least one attention head is required");
        }
        if (outputProjection == null) {
            throw new IllegalArgumentException("Output projection cannot be null");
        }
        if (heads.get(0) == null) {
            throw new IllegalArgumentException("Attention head cannot be null");
        }

        int size = heads.get(0).embeddingSize();
        for (CausalSelfAttention head : heads) {
            if (head == null || head.embeddingSize() != size) {
                throw new IllegalArgumentException("All heads must have the same embedding size");
            }
        }
        long concatenatedSize = (long) size * heads.size();
        if (concatenatedSize > Integer.MAX_VALUE
                || outputProjection.inputSize() != concatenatedSize
                || outputProjection.outputSize() != size) {
            throw new IllegalArgumentException("Invalid output projection dimensions");
        }
        this.heads = List.copyOf(heads);
        this.outputProjection = outputProjection;
        this.embeddingSize = size;
        this.headCount = heads.size();
    }

    /** Original inference API, preserved. */
    public double[][] forward(double[][] input) {
        validateTokens(input, "Input");
        int tokens = input.length;
        double[][] concatenated = concatHeadOutputs(input);
        double[][] output = new double[tokens][];
        for (int t = 0; t < tokens; t++) {
            output[t] = outputProjection.forward(concatenated[t]);
        }
        return output;
    }

    /**
     * Backpropagation for dOutput = dLoss / dMultiHeadOutput.
     * Computes dInput, summed dW/db for output projection, and per-head Q/K/V gradients.
     * No parameters are updated here; call AdamW separately in a later training step.
     */
    public MultiHeadAttentionGradients backward(double[][] input, double[][] dOutput) {
        validateTokens(input, "Input");
        validateTokens(dOutput, "Output gradient");
        if (input.length != dOutput.length) {
            throw new IllegalArgumentException("Input/gradient sequence lengths must match");
        }

        int tokens = input.length;
        int concatenatedSize = embeddingSize * headCount;
        double[][] concatenated = concatHeadOutputs(input);
        double[][] dConcatenated = new double[tokens][concatenatedSize];
        double[][] dProjectionW = new double[concatenatedSize][embeddingSize];
        double[] dProjectionB = new double[embeddingSize];

        // 1. Backward through the SHARED output projection (sum dW and db over tokens).
        for (int t = 0; t < tokens; t++) {
            DenseGradients projectionGradients =
                    outputProjection.backward(concatenated[t], dOutput[t]);
            dConcatenated[t] = projectionGradients.inputGradient();
            addMatrix(dProjectionW, projectionGradients.weightGradients());
            addVector(dProjectionB, projectionGradients.biasGradients());
        }

        // 2. Split each token's concat gradient into one slice per head.
        // 3. Each head performs its OWN Q/K/V backward (including causal masking).
        // 4. Every head saw the same X, so gradients w.r.t. X are SUMMED.
        double[][] dInput = new double[tokens][embeddingSize];
        List<CausalAttentionGradients> perHead = new ArrayList<>(headCount);
        for (int h = 0; h < headCount; h++) {
            double[][] dHeadOutput = new double[tokens][embeddingSize];
            for (int t = 0; t < tokens; t++) {
                System.arraycopy(dConcatenated[t], h * embeddingSize,
                        dHeadOutput[t], 0, embeddingSize);
            }

            CausalAttentionGradients headGradients = heads.get(h).backward(input, dHeadOutput);
            perHead.add(headGradients);
            addMatrix(dInput, headGradients.inputGradient());
        }

        return new MultiHeadAttentionGradients(
                dInput,
                new MultiHeadOutputProjectionGradients(dConcatenated, dProjectionW, dProjectionB),
                perHead);
    }

    private double[][] concatHeadOutputs(double[][] input) {
        double[][] concatenated = new double[input.length][headCount * embeddingSize];
        for (int h = 0; h < headCount; h++) {
            double[][] headOutput = heads.get(h).forward(input);
            for (int t = 0; t < input.length; t++) {
                System.arraycopy(headOutput[t], 0,
                        concatenated[t], h * embeddingSize, embeddingSize);
            }
        }
        return concatenated;
    }

    private void validateTokens(double[][] matrix, String label) {
        if (matrix == null || matrix.length == 0) {
            throw new IllegalArgumentException(label + " cannot be null or empty");
        }
        for (double[] row : matrix) {
            if (row == null || row.length != embeddingSize) {
                throw new IllegalArgumentException(label + " dimensions are invalid");
            }
            for (double value : row) {
                if (!Double.isFinite(value)) {
                    throw new IllegalArgumentException(label + " must contain finite values");
                }
            }
        }
    }

    private static void addMatrix(double[][] target, double[][] next) {
        for (int i = 0; i < target.length; i++) {
            for (int j = 0; j < target[i].length; j++) {
                target[i][j] += next[i][j];
            }
        }
    }

    private static void addVector(double[] target, double[] next) {
        for (int i = 0; i < target.length; i++) {
            target[i] += next[i];
        }
    }

    public int embeddingSize() {
        return embeddingSize;
    }

    public int headCount() {
        return headCount;
    }

    public List<CausalSelfAttention> heads() { return heads; }
    public DenseLayer outputProjection() { return outputProjection; }

}
