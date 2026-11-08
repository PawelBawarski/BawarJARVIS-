package pl.bawar.jarvis.brain.layers;

/** Gradient dla JEDNEGO tokenu: x -> Dense1 -> GELU -> Dense2. */
public record FeedForwardGradients(
        double[] inputGradient,
        DenseGradients inputLayerGradients,
        DenseGradients outputLayerGradients
) {
}
