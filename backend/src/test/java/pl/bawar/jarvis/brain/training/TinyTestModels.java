package pl.bawar.jarvis.brain.training;

import pl.bawar.jarvis.brain.attention.CausalSelfAttention;
import pl.bawar.jarvis.brain.attention.MultiHeadAttention;
import pl.bawar.jarvis.brain.embedding.EmbeddingLayer;
import pl.bawar.jarvis.brain.embedding.PositionalEmbedding;
import pl.bawar.jarvis.brain.layers.DenseLayer;
import pl.bawar.jarvis.brain.layers.FeedForwardNetwork;
import pl.bawar.jarvis.brain.model.JarvisLanguageModel;
import pl.bawar.jarvis.brain.normalization.LayerNormalization;
import pl.bawar.jarvis.brain.tokenizer.CharTokenizer;
import pl.bawar.jarvis.brain.transformer.TransformerBlock;

import java.util.List;
import java.util.Random;

final class TinyTestModels {
    private TinyTestModels() { }

    static JarvisLanguageModel create(String vocabulary, long seed) {
        Random random = new Random(seed);
        CharTokenizer tokenizer = new CharTokenizer(vocabulary);
        int dimension = 4;
        var tokens = new EmbeddingLayer(tokenizer.vocabularySize(), dimension, random.nextLong());
        var positions = new PositionalEmbedding(16, dimension, random.nextLong());
        var head = new CausalSelfAttention(
                dense(dimension, dimension, random), dense(dimension, dimension, random),
                dense(dimension, dimension, random));
        var attention = new MultiHeadAttention(List.of(head), dense(dimension, dimension, random));
        var ffn = new FeedForwardNetwork(dense(dimension, 8, random), dense(8, dimension, random));
        var block = new TransformerBlock(new LayerNormalization(dimension, 1e-5),
                attention, new LayerNormalization(dimension, 1e-5), ffn);
        return new JarvisLanguageModel(tokenizer, tokens, positions, List.of(block),
                new LayerNormalization(dimension, 1e-5),
                dense(dimension, tokenizer.vocabularySize(), random));
    }

    private static DenseLayer dense(int rows, int columns, Random random) {
        double[][] weights = new double[rows][columns];
        for (int i = 0; i < rows; i++) {
            for (int j = 0; j < columns; j++) weights[i][j] = random.nextGaussian() * 0.1;
        }
        return new DenseLayer(weights, new double[columns]);
    }
}
