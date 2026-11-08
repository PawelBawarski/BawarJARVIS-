package pl.bawar.jarvis.brain.attention;

/** Gradients with respect to every input token and the three trainable projections. */
public record CausalAttentionGradients(
        double[][] inputGradient,
        AttentionProjectionGradients queryGradients,
        AttentionProjectionGradients keyGradients,
        AttentionProjectionGradients valueGradients
) {}
