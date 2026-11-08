package pl.bawar.jarvis.brain.normalization;

/** Gradienty dla jednej próbki/tokena, bez akumulacji po batchu. */
public record LayerNormGradients(
        double[] inputGradient,
        double[] gammaGradient,
        double[] betaGradient
) {
}
