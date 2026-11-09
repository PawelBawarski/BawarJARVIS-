package pl.bawar.jarvis.brain.training;

import pl.bawar.jarvis.brain.embedding.EmbeddingLayer;
import pl.bawar.jarvis.brain.embedding.PositionalEmbedding;
import pl.bawar.jarvis.brain.layers.DenseLayer;
import pl.bawar.jarvis.brain.loss.CrossEntropyGradient;
import pl.bawar.jarvis.brain.loss.CrossEntropyLoss;
import pl.bawar.jarvis.brain.model.JarvisLanguageModel;
import pl.bawar.jarvis.brain.model.LanguageModelHeadBackward;
import pl.bawar.jarvis.brain.model.LanguageModelHeadGradients;
import pl.bawar.jarvis.brain.normalization.LayerNormBatchGradients;
import pl.bawar.jarvis.brain.normalization.LayerNormGradients;
import pl.bawar.jarvis.brain.normalization.LayerNormalization;
import pl.bawar.jarvis.brain.tokenizer.CharTokenizer;
import pl.bawar.jarvis.brain.transformer.TransformerBlock;
import pl.bawar.jarvis.brain.transformer.TransformerBlockGradients;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Teacher-forced next-character training for the same object graph used by inference.
 * Full-model backpropagation + one AdamW step per unpadded sequence.
 * Educational CPU implementation: recomputes forward intermediates; no GPU or minibatching.
 * One trainer per model; do not train concurrently with model inference.
 */
public final class FullModelTrainer {
    private final JarvisLanguageModel model;
    private final AdamWModelUpdater updater;
    private final double maxGradientNorm;

    public FullModelTrainer(JarvisLanguageModel model, double learningRate,
                            double weightDecay, double maxGradientNorm) {
        if (model == null || !Double.isFinite(maxGradientNorm) || maxGradientNorm <= 0) {
            throw new IllegalArgumentException("Model and clipping norm must be valid");
        }
        this.model = model;
        this.updater = new AdamWModelUpdater(learningRate, weightDecay);
        this.maxGradientNorm = maxGradientNorm;
    }

    /** One optimizer step per text. Every target, including EOS, contributes to the mean loss. */
    public TrainingMetrics trainExample(String text) {
        int[] all = encode(text);
        int[] inputIds = Arrays.copyOf(all, all.length - 1);
        int[] targets = Arrays.copyOfRange(all, 1, all.length);
        ForwardPass forward = forward(inputIds);
        int count = targets.length;
        int vocabularySize = model.vocabularySize();
        double loss = 0;
        double[][] dLogits = new double[count][vocabularySize];
        DenseLayer head = model.languageModelHead();
        for (int t = 0; t < count; t++) {
            double[] logits = head.forward(forward.normalized()[t]);
            loss += CrossEntropyLoss.calculate(logits, targets[t]);
            dLogits[t] = CrossEntropyGradient.calculate(logits, targets[t]);
            // Mean loss over target positions: scale gradients before chain rule.
            for (int v = 0; v < vocabularySize; v++) dLogits[t][v] /= count;
        }
        loss /= count;

        LanguageModelHeadGradients dHead = LanguageModelHeadBackward.calculate(
                head, forward.normalized(), dLogits);
        LayerNormBatchGradients dFinalNorm = backwardNorm(model.finalNorm(),
                forward.blockOutput(), dHead.inputGradients());

        List<TransformerBlock> blocks = model.blocks();
        List<TransformerBlockGradients> dBlocks = new ArrayList<>(
                java.util.Collections.nCopies(blocks.size(), null));
        double[][] dHidden = dFinalNorm.inputGradients();
        for (int b = blocks.size() - 1; b >= 0; b--) {
            TransformerBlockGradients gradient = blocks.get(b).backward(
                    forward.blockInputs().get(b), dHidden);
            dBlocks.set(b, gradient);
            dHidden = gradient.inputGradients();
        }
        double[][] dPositions = model.positionalEmbeddings().backward(dHidden);
        double[][] dTokens = model.tokenEmbeddings().backward(inputIds, dHidden);

        double norm = AdamWModelUpdater.norm(dTokens, dPositions, dBlocks, dFinalNorm, dHead);
        double scale = norm > maxGradientNorm ? maxGradientNorm / norm : 1.0;
        // Update only after the entire gradient is computed: no layer sees partially changed weights.
        updater.apply(model.tokenEmbeddings(), model.positionalEmbeddings(), blocks,
                model.finalNorm(), head, dTokens, dPositions, dBlocks, dFinalNorm, dHead, scale);
        return new TrainingMetrics(loss, count, norm, scale);
    }

    /** Per-token mean cross entropy, without modifying weights or optimizer state. */
    public double evaluateExample(String text) {
        int[] all = encode(text);
        int[] inputIds = Arrays.copyOf(all, all.length - 1);
        ForwardPass pass = forward(inputIds);
        double loss = 0;
        for (int t = 0; t < inputIds.length; t++) {
            loss += CrossEntropyLoss.calculate(
                    model.languageModelHead().forward(pass.normalized()[t]), all[t + 1]);
        }
        return loss / inputIds.length;
    }

    /** Online training across examples; loss is weighted by the number of target positions. */
    public double trainEpoch(List<String> examples) {
        if (examples == null || examples.isEmpty()) {
            throw new IllegalArgumentException("Training examples cannot be empty");
        }
        double total = 0;
        int tokens = 0;
        for (String example : examples) {
            TrainingMetrics result = trainExample(example);
            total += result.lossBefore() * result.targetCount();
            tokens += result.targetCount();
        }
        return total / tokens;
    }

    private int[] encode(String text) {
        int[] ids = model.tokenizer().encode(text);
        // Input is BOS + text; targets are text + EOS. No PAD means no padding mask required.
        if (ids.length < 2 || ids.length - 1 > model.contextLength()) {
            throw new IllegalArgumentException("Training sequence exceeds context length");
        }
        for (int id : ids) {
            if (id == CharTokenizer.UNK || id == CharTokenizer.PAD) {
                throw new IllegalArgumentException("Corpus contains unknown/padding token");
            }
        }
        return ids;
    }

    private ForwardPass forward(int[] inputIds) {
        EmbeddingLayer tokens = model.tokenEmbeddings();
        PositionalEmbedding positions = model.positionalEmbeddings();
        double[][] hidden = positions.forward(tokens.forward(inputIds));
        List<double[][]> blockInputs = new ArrayList<>();
        for (TransformerBlock block : model.blocks()) {
            blockInputs.add(hidden);
            hidden = block.forward(hidden);
        }
        return new ForwardPass(List.copyOf(blockInputs), hidden, model.finalNorm().forward(hidden));
    }

    private static LayerNormBatchGradients backwardNorm(
            LayerNormalization norm, double[][] x, double[][] dy) {
        double[][] dx = new double[x.length][];
        double[] dg = new double[norm.embeddingSize()];
        double[] db = new double[norm.embeddingSize()];
        for (int t = 0; t < x.length; t++) {
            LayerNormGradients g = norm.backward(x[t], dy[t]);
            dx[t] = g.inputGradient();
            for (int d = 0; d < dg.length; d++) {
                dg[d] += g.gammaGradient()[d];
                db[d] += g.betaGradient()[d];
            }
        }
        return new LayerNormBatchGradients(dx, dg, db);
    }

    private record ForwardPass(List<double[][]> blockInputs,
                               double[][] blockOutput, double[][] normalized) { }

    // Package-private checkpoint access. Only call while training is stopped.
    JarvisLanguageModel model() { return model; }
    AdamWModelUpdater updater() { return updater; }
    double maxGradientNorm() { return maxGradientNorm; }

}
