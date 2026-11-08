
package pl.bawar.jarvis.brain.attention;

import pl.bawar.jarvis.brain.layers.DenseLayer;

import java.util.List;

public final class MultiHeadAttention {

    private final List<CausalSelfAttention> heads;
    private final DenseLayer outputProjection;

    private final int embeddingSize;
    private final int headCount;

    public MultiHeadAttention(
            List<CausalSelfAttention> heads,
            DenseLayer outputProjection) {
        if (heads == null || heads.isEmpty()) {
            throw new IllegalArgumentException(
                    "At least one attention head is required");
        }

        if (outputProjection == null) {
            throw new IllegalArgumentException(
                    "Output projection cannot be null");
        }

        if (heads.get(0) == null) {
            throw new IllegalArgumentException(
                    "Attention head cannot be null");
        }

        int size = heads.get(0).embeddingSize();

        for (CausalSelfAttention head : heads) {
            if (head == null || head.embeddingSize() != size) {
                throw new IllegalArgumentException(
                        "All heads must have the same embedding size");
            }
        }

        long concatenatedSize = (long) size * heads.size();

        if (concatenatedSize > Integer.MAX_VALUE ||
                outputProjection.inputSize() != concatenatedSize ||
                outputProjection.outputSize() != size) {
            throw new IllegalArgumentException(
                    "Invalid output projection dimensions");
        }

        this.heads = List.copyOf(heads);
        this.outputProjection = outputProjection;
        this.embeddingSize = size;
        this.headCount = heads.size();
    }

    public double[][] forward(double[][] input) {

        if (input == null || input.length == 0) {
            throw new IllegalArgumentException(
                    "Input cannot be null or empty");
        }

        int sequenceLength = input.length;

        for (double[] token : input) {
            if (token == null ||
                    token.length != embeddingSize) {
                throw new IllegalArgumentException(
                        "Invalid token dimensions");
            }
        }

        // Miejsce na połączone wyniki wszystkich głowic.
        double[][] concatenated = new double[sequenceLength][headCount * embeddingSize];

        // Każda głowica analizuje tę samą sekwencję.
        for (int h = 0; h < headCount; h++) {

            double[][] headOutput = heads.get(h).forward(input);

            for (int token = 0; token < sequenceLength; token++) {

                System.arraycopy(
                        headOutput[token],
                        0,
                        concatenated[token],
                        h * embeddingSize,
                        embeddingSize);
            }
        }

        // Wspólna projekcja wyników wszystkich głowic.
        double[][] output = new double[sequenceLength][embeddingSize];

        for (int token = 0; token < sequenceLength; token++) {
            output[token] = outputProjection.forward(
                    concatenated[token]);
        }

        return output;
    }

    public int embeddingSize() {
        return embeddingSize;
    }

    public int headCount() {
        return headCount;
    }
}
