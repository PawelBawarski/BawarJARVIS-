
package pl.bawar.jarvis.brain.model;

import pl.bawar.jarvis.brain.attention.CausalSelfAttention;
import pl.bawar.jarvis.brain.attention.MultiHeadAttention;
import pl.bawar.jarvis.brain.embedding.EmbeddingLayer;
import pl.bawar.jarvis.brain.embedding.PositionalEmbedding;
import pl.bawar.jarvis.brain.layers.DenseLayer;
import pl.bawar.jarvis.brain.layers.FeedForwardNetwork;
import pl.bawar.jarvis.brain.normalization.LayerNormalization;
import pl.bawar.jarvis.brain.tokenizer.CharTokenizer;
import pl.bawar.jarvis.brain.transformer.TransformerBlock;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

public final class TinyGptFactory {

    private static final int EMBEDDING_SIZE = 8;
    private static final int HIDDEN_SIZE = 32;
    private static final int HEAD_COUNT = 2;
    private static final int CONTEXT_LENGTH = 128;

    private static final double EPSILON = 1e-5;

    private TinyGptFactory() {
    }

    public static JarvisLanguageModel create(
            String vocabularyText,
            long seed) {
        Random random = new Random(seed);

        // 1. Budujemy słownik znaków.
        CharTokenizer tokenizer = new CharTokenizer(vocabularyText);

        int vocabularySize = tokenizer.vocabularySize();

        // 2. Inicjalizujemy embeddingi.
        EmbeddingLayer tokens = new EmbeddingLayer(
                vocabularySize,
                EMBEDDING_SIZE,
                random.nextLong());

        PositionalEmbedding positions = new PositionalEmbedding(
                CONTEXT_LENGTH,
                EMBEDDING_SIZE,
                random.nextLong());

        // 3. Budujemy dwie głowice Attention.
        List<CausalSelfAttention> heads = new ArrayList<>();

        for (int i = 0; i < HEAD_COUNT; i++) {

            heads.add(new CausalSelfAttention(
                    randomDense(
                            EMBEDDING_SIZE,
                            EMBEDDING_SIZE,
                            random),
                    randomDense(
                            EMBEDDING_SIZE,
                            EMBEDDING_SIZE,
                            random),
                    randomDense(
                            EMBEDDING_SIZE,
                            EMBEDDING_SIZE,
                            random)));
        }

        // 4. Projekcja po połączeniu głowic.
        DenseLayer attentionOutput = randomDense(
                HEAD_COUNT * EMBEDDING_SIZE,
                EMBEDDING_SIZE,
                random);

        MultiHeadAttention attention = new MultiHeadAttention(
                heads,
                attentionOutput);

        // 5. Feed-Forward Network.
        FeedForwardNetwork feedForward = new FeedForwardNetwork(
                randomDense(
                        EMBEDDING_SIZE,
                        HIDDEN_SIZE,
                        random),
                randomDense(
                        HIDDEN_SIZE,
                        EMBEDDING_SIZE,
                        random));

        // 6. Jeden kompletny Transformer Block.
        TransformerBlock block = new TransformerBlock(
                new LayerNormalization(
                        EMBEDDING_SIZE, EPSILON),
                attention,
                new LayerNormalization(
                        EMBEDDING_SIZE, EPSILON),
                feedForward);

        // 7. Projekcja na słownik tokenów.
        DenseLayer languageModelHead = randomDense(
                EMBEDDING_SIZE,
                vocabularySize,
                random);

        return new JarvisLanguageModel(
                tokenizer,
                tokens,
                positions,
                List.of(block),
                new LayerNormalization(
                        EMBEDDING_SIZE, EPSILON),
                languageModelHead);
    }

    private static DenseLayer randomDense(
            int inputSize,
            int outputSize,
            Random random) {
        double[][] weights = new double[inputSize][outputSize];

        double scale = Math.sqrt(2.0 / (inputSize + outputSize));

        for (int i = 0; i < inputSize; i++) {
            for (int j = 0; j < outputSize; j++) {
                weights[i][j] = random.nextGaussian() * scale;
            }
        }

        return new DenseLayer(
                weights,
                new double[outputSize]);
    }
}
