package pl.bawar.jarvis.brain.training;

import pl.bawar.jarvis.brain.attention.AttentionProjectionGradients;
import pl.bawar.jarvis.brain.attention.CausalAttentionGradients;
import pl.bawar.jarvis.brain.attention.CausalSelfAttention;
import pl.bawar.jarvis.brain.attention.MultiHeadAttention;
import pl.bawar.jarvis.brain.attention.MultiHeadAttentionGradients;
import pl.bawar.jarvis.brain.embedding.EmbeddingLayer;
import pl.bawar.jarvis.brain.embedding.PositionalEmbedding;
import pl.bawar.jarvis.brain.layers.DenseLayer;
import pl.bawar.jarvis.brain.layers.FeedForwardBatchGradients;
import pl.bawar.jarvis.brain.model.LanguageModelHeadGradients;
import pl.bawar.jarvis.brain.normalization.LayerNormBatchGradients;
import pl.bawar.jarvis.brain.normalization.LayerNormalization;
import pl.bawar.jarvis.brain.optimization.AdamWOptimizer;
import pl.bawar.jarvis.brain.transformer.TransformerBlock;
import pl.bawar.jarvis.brain.transformer.TransformerBlockGradients;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Persistent AdamW state for every independent model parameter vector. */
final class AdamWModelUpdater {
    private final Map<String, AdamWOptimizer> optimizers = new HashMap<>();
    private final double learningRate;
    private final double weightDecay;

    AdamWModelUpdater(double learningRate, double weightDecay) {
        if (!Double.isFinite(learningRate) || learningRate <= 0
                || !Double.isFinite(weightDecay) || weightDecay < 0) {
            throw new IllegalArgumentException("Invalid optimizer configuration");
        }
        this.learningRate = learningRate;
        this.weightDecay = weightDecay;
    }

    void apply(EmbeddingLayer tokens, PositionalEmbedding positions,
               List<TransformerBlock> blocks, LayerNormalization finalNorm,
               DenseLayer head, double[][] dTokens, double[][] dPositions,
               List<TransformerBlockGradients> dBlocks,
               LayerNormBatchGradients dFinalNorm, LanguageModelHeadGradients dHead,
               double scale) {
        double[][] tokenWeights = tokens.weightsCopy();
        // PAD token ID 0 is frozen. It is never weight-decayed.
        for (int i = 1; i < tokenWeights.length; i++) {
            step("tokens." + i, tokenWeights[i], dTokens[i], scale, weightDecay);
        }
        tokens.replaceWeights(tokenWeights);
        double[][] positionWeights = positions.weightsCopy();
        for (int i = 0; i < positionWeights.length; i++) {
            step("positions." + i, positionWeights[i], dPositions[i], scale, weightDecay);
        }
        positions.replaceWeights(positionWeights);

        for (int b = 0; b < blocks.size(); b++) {
            updateBlock("blocks." + b, blocks.get(b), dBlocks.get(b), scale);
        }
        updateNorm("finalNorm", finalNorm, dFinalNorm, scale);
        updateDense("head", head, dHead.weightGradients(), dHead.biasGradients(), scale);
    }

    private void updateBlock(String path, TransformerBlock block,
                             TransformerBlockGradients gradients, double scale) {
        updateNorm(path + ".ln1", block.attentionNorm(),
                gradients.attentionNormGradients(), scale);
        MultiHeadAttention mha = block.attention();
        MultiHeadAttentionGradients dg = gradients.attentionGradients();
        updateDense(path + ".attention.out", mha.outputProjection(),
                dg.outputProjectionGradients().weightGradients(),
                dg.outputProjectionGradients().biasGradients(), scale);
        for (int h = 0; h < mha.heads().size(); h++) {
            CausalSelfAttention sub = mha.heads().get(h);
            CausalAttentionGradients gh = dg.headGradients().get(h);
            String hp = path + ".head." + h;
            updateProjection(hp + ".q", sub.queryProjection(), gh.queryGradients(), scale);
            updateProjection(hp + ".k", sub.keyProjection(), gh.keyGradients(), scale);
            updateProjection(hp + ".v", sub.valueProjection(), gh.valueGradients(), scale);
        }
        updateNorm(path + ".ln2", block.feedForwardNorm(),
                gradients.feedForwardNormGradients(), scale);
        FeedForwardBatchGradients ff = gradients.feedForwardGradients();
        updateDense(path + ".ffn.1", block.feedForward().inputLayer(),
                ff.inputWeightGradients(), ff.inputBiasGradients(), scale);
        updateDense(path + ".ffn.2", block.feedForward().outputLayer(),
                ff.outputWeightGradients(), ff.outputBiasGradients(), scale);
    }

    private void updateProjection(String path, DenseLayer layer,
                                  AttentionProjectionGradients g, double scale) {
        updateDense(path, layer, g.weightGradients(), g.biasGradients(), scale);
    }

    private void updateNorm(String path, LayerNormalization layer,
                            LayerNormBatchGradients grad, double scale) {
        double[] gamma = layer.gamma();
        double[] beta = layer.beta();
        step(path + ".gamma", gamma, grad.gammaGradients(), scale, 0);
        step(path + ".beta", beta, grad.betaGradients(), scale, 0);
        layer.setAffineParameters(gamma, beta);
    }

    private void updateDense(String path, DenseLayer layer,
                             double[][] dWeights, double[] dBias, double scale) {
        double[][] weights = layer.weightsCopy();
        double[] biases = layer.biasesCopy();
        if (weights.length != dWeights.length) {
            throw new IllegalArgumentException("Weight gradient rows mismatch: " + path);
        }
        for (int i = 0; i < weights.length; i++) {
            step(path + ".w." + i, weights[i], dWeights[i], scale, weightDecay);
        }
        step(path + ".b", biases, dBias, scale, 0);
        layer.replaceParameters(weights, biases);
    }

    private void step(String path, double[] parameters, double[] gradients,
                      double scale, double decay) {
        if (gradients == null || gradients.length != parameters.length) {
            throw new IllegalArgumentException("Gradient dimension mismatch: " + path);
        }
        double[] scaled = new double[gradients.length];
        for (int i = 0; i < scaled.length; i++) {
            scaled[i] = gradients[i] * scale;
            if (!Double.isFinite(scaled[i])) {
                throw new IllegalArgumentException("Non-finite gradient: " + path);
            }
        }
        AdamWOptimizer optimizer = optimizers.computeIfAbsent(path,
                k -> new AdamWOptimizer(parameters.length, learningRate, decay));
        optimizer.step(parameters, scaled);
    }

    static double squared(double[] v) {
        double sum = 0;
        for (double x : v) {
            if (!Double.isFinite(x)) throw new IllegalArgumentException("Non-finite gradient");
            sum += x * x;
        }
        return sum;
    }
    static double squared(double[][] m) {
        double sum = 0;
        for (double[] row : m) sum += squared(row);
        return sum;
    }

    static double norm(double[][] dTokens, double[][] dPositions,
                       List<TransformerBlockGradients> dBlocks,
                       LayerNormBatchGradients dFinal, LanguageModelHeadGradients dHead) {
        double n2 = squared(dTokens) + squared(dPositions)
                + squared(dFinal.gammaGradients()) + squared(dFinal.betaGradients())
                + squared(dHead.weightGradients()) + squared(dHead.biasGradients());
        for (TransformerBlockGradients b : dBlocks) {
            n2 += squared(b.attentionNormGradients().gammaGradients());
            n2 += squared(b.attentionNormGradients().betaGradients());
            n2 += squared(b.feedForwardNormGradients().gammaGradients());
            n2 += squared(b.feedForwardNormGradients().betaGradients());
            n2 += squared(b.feedForwardGradients().inputWeightGradients());
            n2 += squared(b.feedForwardGradients().inputBiasGradients());
            n2 += squared(b.feedForwardGradients().outputWeightGradients());
            n2 += squared(b.feedForwardGradients().outputBiasGradients());
            MultiHeadAttentionGradients a = b.attentionGradients();
            n2 += squared(a.outputProjectionGradients().weightGradients());
            n2 += squared(a.outputProjectionGradients().biasGradients());
            for (CausalAttentionGradients h : a.headGradients()) {
                n2 += squared(h.queryGradients().weightGradients());
                n2 += squared(h.queryGradients().biasGradients());
                n2 += squared(h.keyGradients().weightGradients());
                n2 += squared(h.keyGradients().biasGradients());
                n2 += squared(h.valueGradients().weightGradients());
                n2 += squared(h.valueGradients().biasGradients());
            }
        }
        double norm = Math.sqrt(n2);
        if (!Double.isFinite(norm)) throw new ArithmeticException("Non-finite gradient norm");
        return norm;
    }
}
