
package pl.bawar.jarvis.brain.attention;

import pl.bawar.jarvis.brain.layers.DenseLayer;
import pl.bawar.jarvis.brain.math.MatrixOps;

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
        if (queryProjection == null ||
                keyProjection == null ||
                valueProjection == null) {
            throw new IllegalArgumentException(
                    "Attention projections cannot be null");
        }

        int size = queryProjection.inputSize();

        // Pierwsza wersja: jedna głowica, wektory
        // Q, K i V mają rozmiar embeddingu.
        if (queryProjection.outputSize() != size ||
                keyProjection.inputSize() != size ||
                keyProjection.outputSize() != size ||
                valueProjection.inputSize() != size ||
                valueProjection.outputSize() != size) {
            throw new IllegalArgumentException(
                    "Attention projection dimensions must match");
        }

        this.queryProjection = queryProjection;
        this.keyProjection = keyProjection;
        this.valueProjection = valueProjection;

        this.embeddingSize = size;
        this.scale = 1.0 / Math.sqrt(size);
    }

    public double[][] forward(double[][] input) {

        if (input == null || input.length == 0) {
            throw new IllegalArgumentException(
                    "Attention input cannot be null or empty");
        }

        int sequenceLength = input.length;

        double[][] queries = new double[sequenceLength][embeddingSize];

        double[][] keys = new double[sequenceLength][embeddingSize];

        double[][] values = new double[sequenceLength][embeddingSize];

        // Krok 1: Obliczamy Q, K i V dla każdego tokenu.
        for (int i = 0; i < sequenceLength; i++) {

            if (input[i] == null ||
                    input[i].length != embeddingSize) {
                throw new IllegalArgumentException(
                        "Invalid attention input dimensions");
            }

            queries[i] = queryProjection.forward(input[i]);
            keys[i] = keyProjection.forward(input[i]);
            values[i] = valueProjection.forward(input[i]);
        }

        double[][] output = new double[sequenceLength][embeddingSize];

        // Krok 2: Obliczamy Attention dla każdego tokenu.
        for (int i = 0; i < sequenceLength; i++) {

            // CAUSAL MASK:
            // Token i widzi wyłącznie tokeny 0 ... i.
            double[] scores = new double[i + 1];

            for (int j = 0; j <= i; j++) {

                double dotProduct = 0.0;

                for (int k = 0; k < embeddingSize; k++) {
                    dotProduct += queries[i][k] * keys[j][k];
                }

                // Scaled Dot-Product Attention.
                scores[j] = dotProduct * scale;
            }

            // Krok 3: Wyniki podobieństwa zamieniamy
            // na wagi sumujące się do 1.
            double[] attentionWeights = MatrixOps.softmax(scores);

            // Krok 4: Obliczamy ważoną sumę wektorów V.
            for (int j = 0; j <= i; j++) {
                for (int k = 0; k < embeddingSize; k++) {
                    output[i][k] += attentionWeights[j] * values[j][k];
                }
            }
        }

        return output;
    }

    public int embeddingSize() {
        return embeddingSize;
    }
}
