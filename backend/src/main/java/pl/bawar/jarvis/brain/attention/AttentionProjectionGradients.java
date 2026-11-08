package pl.bawar.jarvis.brain.attention;

/** Gradients accumulated over all tokens for ONE shared Q, K or V projection. */
public record AttentionProjectionGradients(
        double[][] weightGradients,
        double[] biasGradients
) {}
