package pl.bawar.jarvis.brain.training;

import pl.bawar.jarvis.brain.model.JarvisLanguageModel;
import pl.bawar.jarvis.brain.tokenizer.CharTokenizer;

import java.util.Random;

/** Bounded autoregressive character generation. Temperature = 0 means greedy decoding. */
public final class TextGenerator {
    private final JarvisLanguageModel model;

    public TextGenerator(JarvisLanguageModel model) {
        if (model == null) throw new IllegalArgumentException("Model required");
        this.model = model;
    }

    public GenerationResult generate(String prompt, int maxNewTokens, double temperature, long seed) {
        if (prompt == null || maxNewTokens < 0 || maxNewTokens > 10000
                || !Double.isFinite(temperature) || temperature < 0) {
            throw new IllegalArgumentException("Invalid generation configuration");
        }
        int[] promptIds = model.tokenizer().encodePrompt(prompt);
        for (int id : promptIds) {
            if (id == CharTokenizer.UNK || id == CharTokenizer.PAD) {
                throw new IllegalArgumentException("Prompt contains a token outside model vocabulary");
            }
        }
        if (promptIds.length > model.contextLength()) {
            throw new IllegalArgumentException("Prompt exceeds context window");
        }
        Random random = new Random(seed);
        StringBuilder result = new StringBuilder(prompt);
        int generated = 0;
        while (generated < maxNewTokens) {
            int currentLength = result.codePointCount(0, result.length()) + 1; // BOS
            if (currentLength > model.contextLength()) break; // never overrun context
            double[] probabilities = model.nextTokenProbabilities(result.toString());
            int id = choose(probabilities, temperature, random);
            if (id == CharTokenizer.EOS) {
                return new GenerationResult(result.toString(), generated, true);
            }
            if (id < 4) throw new IllegalStateException("Illegal generated special token");
            result.append(model.tokenizer().decode(new int[]{id}));
            generated++;
        }
        return new GenerationResult(result.toString(), generated, false);
    }

    private static int choose(double[] probabilities, double temperature, Random random) {
        int best = CharTokenizer.EOS;
        for (int i = CharTokenizer.EOS; i < probabilities.length; i++) {
            if (!Double.isFinite(probabilities[i]) || probabilities[i] < 0) {
                throw new IllegalStateException("Invalid model probability");
            }
            if (probabilities[i] > probabilities[best]) best = i;
        }
        if (temperature == 0) return best;
        // Temperature on probabilities: softmax(log(p) / T), shifted for stability.
        double[] score = new double[probabilities.length];
        double maximum = Double.NEGATIVE_INFINITY;
        for (int i = CharTokenizer.EOS; i < score.length; i++) {
            score[i] = probabilities[i] == 0 ? Double.NEGATIVE_INFINITY
                    : Math.log(probabilities[i]) / temperature;
            maximum = Math.max(maximum, score[i]);
        }
        if (!Double.isFinite(maximum)) throw new IllegalStateException("Model assigned no probability");
        double sum = 0;
        for (int i = CharTokenizer.EOS; i < score.length; i++) {
            score[i] = score[i] == Double.NEGATIVE_INFINITY ? 0 : Math.exp(score[i] - maximum);
            sum += score[i];
        }
        double threshold = random.nextDouble() * sum;
        double cumulative = 0;
        for (int i = CharTokenizer.EOS; i < score.length; i++) {
            cumulative += score[i];
            if (threshold < cumulative) return i;
        }
        return best; // floating point rounding only
    }
}
