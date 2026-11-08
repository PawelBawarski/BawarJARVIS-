package pl.bawar.jarvis.brain.layers;

/**
 * Gradienty wielu tokenow. Wagi FFN sa wspolne dla tokenow, wiec gradienty
 * parametrow sumujemy po tokenach (bez dzielenia przez liczbe tokenow).
 * Przy sredniej funkcji straty dOutput nalezy wczesniej podzielic przez N.
 */
public record FeedForwardBatchGradients(
        double[][] inputGradients,
        double[][] inputWeightGradients,
        double[] inputBiasGradients,
        double[][] outputWeightGradients,
        double[] outputBiasGradients
) {
}
