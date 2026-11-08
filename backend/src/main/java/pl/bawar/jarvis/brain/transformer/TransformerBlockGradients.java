package pl.bawar.jarvis.brain.transformer;

import pl.bawar.jarvis.brain.attention.MultiHeadAttentionGradients;
import pl.bawar.jarvis.brain.layers.FeedForwardBatchGradients;
import pl.bawar.jarvis.brain.normalization.LayerNormBatchGradients;

/** All gradients required to train one pre-norm transformer block. */
public record TransformerBlockGradients(
        double[][] inputGradients,
        LayerNormBatchGradients attentionNormGradients,
        MultiHeadAttentionGradients attentionGradients,
        LayerNormBatchGradients feedForwardNormGradients,
        FeedForwardBatchGradients feedForwardGradients
) {
}
