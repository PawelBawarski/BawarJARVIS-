package pl.bawar.jarvis.brain.model;

/** Gradients of shared LM output projection, accumulated over all sequence positions. */
public record LanguageModelHeadGradients(
        double[][] inputGradients,
        double[][] weightGradients,
        double[] biasGradients
) { }
