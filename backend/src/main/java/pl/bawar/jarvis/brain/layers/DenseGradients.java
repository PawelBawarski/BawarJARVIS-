package pl.bawar.jarvis.brain.layers;

public record DenseGradients(
        double[] inputGradient,
        double[][] weightGradients,
        double[] biasGradients) {
}
