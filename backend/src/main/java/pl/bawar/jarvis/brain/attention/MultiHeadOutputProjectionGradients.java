package pl.bawar.jarvis.brain.attention;

/** Output projection gradients aggregated over all tokens (the input has a token axis). */
public record MultiHeadOutputProjectionGradients(
        double[][] inputGradient,
        double[][] weightGradients,
        double[] biasGradients
) {}
