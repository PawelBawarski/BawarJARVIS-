package pl.bawar.jarvis.brain.normalization;

/** Backward of LayerNorm across tokens: per-token dX, shared dGamma and dBeta summed. */
public record LayerNormBatchGradients(
        double[][] inputGradients,
        double[] gammaGradients,
        double[] betaGradients
) {
}
