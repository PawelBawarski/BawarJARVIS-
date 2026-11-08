
package pl.bawar.jarvis.brain.transformer;

import pl.bawar.jarvis.brain.attention.MultiHeadAttention;
import pl.bawar.jarvis.brain.layers.FeedForwardNetwork;
import pl.bawar.jarvis.brain.math.ResidualConnection;
import pl.bawar.jarvis.brain.normalization.LayerNormalization;

public final class TransformerBlock {

    private final LayerNormalization attentionNorm;
    private final MultiHeadAttention attention;

    private final LayerNormalization feedForwardNorm;
    private final FeedForwardNetwork feedForward;

    private final int embeddingSize;

    public TransformerBlock(
            LayerNormalization attentionNorm,
            MultiHeadAttention attention,
            LayerNormalization feedForwardNorm,
            FeedForwardNetwork feedForward) {
        if (attentionNorm == null ||
                attention == null ||
                feedForwardNorm == null ||
                feedForward == null) {
            throw new IllegalArgumentException(
                    "Transformer components cannot be null");
        }

        int size = attention.embeddingSize();

        if (attentionNorm.embeddingSize() != size ||
                feedForwardNorm.embeddingSize() != size ||
                feedForward.embeddingSize() != size) {
            throw new IllegalArgumentException(
                    "Transformer dimensions must match");
        }

        this.attentionNorm = attentionNorm;
        this.attention = attention;
        this.feedForwardNorm = feedForwardNorm;
        this.feedForward = feedForward;
        this.embeddingSize = size;
    }

    public double[][] forward(double[][] input) {

        validateInput(input);

        // 1. Normalizacja przed Attention.
        double[][] normalizedInput = attentionNorm.forward(input);

        // 2. Multi-Head Causal Self-Attention.
        double[][] attentionOutput = attention.forward(normalizedInput);

        // 3. Pierwsze połączenie rezydualne.
        double[][] afterAttention = ResidualConnection.add(
                input,
                attentionOutput);

        // 4. Normalizacja przed FFN.
        double[][] normalizedAttention = feedForwardNorm.forward(afterAttention);

        // 5. Feed-Forward Network.
        double[][] feedForwardOutput = feedForward.forward(normalizedAttention);

        // 6. Drugie połączenie rezydualne.
        return ResidualConnection.add(
                afterAttention,
                feedForwardOutput);
    }

    public int embeddingSize() {
        return embeddingSize;
    }

    private void validateInput(double[][] input) {

        if (input == null || input.length == 0) {
            throw new IllegalArgumentException(
                    "Transformer input cannot be null or empty");
        }

        for (double[] token : input) {

            if (token == null ||
                    token.length != embeddingSize) {
                throw new IllegalArgumentException(
                        "Invalid token embedding dimensions");
            }

            for (double value : token) {
                if (!Double.isFinite(value)) {
                    throw new IllegalArgumentException(
                            "Input values must be finite");
                }
            }
        }
    }
}
