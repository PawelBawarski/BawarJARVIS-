package pl.bawar.jarvis.brain.attention;

import java.util.List;

/** Gradients for the entire multi-head block, before optimizer updates. */
public record MultiHeadAttentionGradients(
        double[][] inputGradient,
        MultiHeadOutputProjectionGradients outputProjectionGradients,
        List<CausalAttentionGradients> headGradients
) {
    public MultiHeadAttentionGradients {
        // Protect the list structure; numerical arrays are intentionally mutable.
        headGradients = List.copyOf(headGradients);
    }
}
