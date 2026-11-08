package pl.bawar.jarvis.brain.training;

import org.junit.jupiter.api.Test;
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

import java.util.Arrays;
import java.util.List;
import java.util.Random;

import static org.junit.jupiter.api.Assertions.*;

class FullModelTrainerTest {

    private static DenseLayer dense(int inputs, int outputs, Random random) {
        double[][] weights = new double[inputs][outputs];
        for (int i = 0; i < inputs; i++) {
            for (int j = 0; j < outputs; j++) {
                weights[i][j] = random.nextGaussian() * 0.1;
            }
        }
        return new DenseLayer(weights, new double[outputs]);
    }

    private static JarvisLanguageModel tinyModel() {
        Random random = new Random(42);
        CharTokenizer tokenizer = new CharTokenizer("ababab");
        int dim = 4;
        int vocab = tokenizer.vocabularySize();
        var tokens = new EmbeddingLayer(vocab, dim, 42);
        var positions = new PositionalEmbedding(16, dim, 43);
        var head = new CausalSelfAttention(
                dense(dim, dim, random),
                dense(dim, dim, random),
                dense(dim, dim, random));
        var attention = new MultiHeadAttention(List.of(head), dense(dim, dim, random));
        var ffn = new FeedForwardNetwork(dense(dim, 8, random), dense(8, dim, random));
        var block = new TransformerBlock(new LayerNormalization(dim, 1e-5),
                attention, new LayerNormalization(dim, 1e-5), ffn);
        return new JarvisLanguageModel(tokenizer, tokens, positions,
                List.of(block), new LayerNormalization(dim, 1e-5), dense(dim, vocab, random));
    }

    @Test
    void shouldReduceMeanNextTokenLossAndChangeInference() {
        JarvisLanguageModel model = tinyModel();
        FullModelTrainer trainer = new FullModelTrainer(model, 0.007, 0.0, 1.0);
        double lossBefore = trainer.evaluateExample("abab");
        double[] probabilityBefore = model.nextTokenProbabilities("ab");

        for (int i = 0; i < 80; i++) trainer.trainExample("abab");

        double lossAfter = trainer.evaluateExample("abab");
        assertTrue(lossAfter < lossBefore * 0.5,
                "Training should significantly reduce the mean next-token loss");
        assertFalse(Arrays.equals(probabilityBefore, model.nextTokenProbabilities("ab")),
                "Inference on the SAME model instance must change after training");
    }

    @Test
    void shouldUpdateAttentionEmbeddingsAndHeadButNeverPad() {
        JarvisLanguageModel model = tinyModel();
        FullModelTrainer trainer = new FullModelTrainer(model, 0.007, 0.0, 1.0);
        var head = model.blocks().get(0).attention().heads().get(0);
        double[] queryBefore = head.queryProjection().weightsCopy()[0];
        double[] keyBefore = head.keyProjection().weightsCopy()[0];
        double[] valueBefore = head.valueProjection().weightsCopy()[0];
        double[] embeddingBefore = model.tokenEmbeddings().weightsCopy()[4];
        double[] lmHeadBefore = model.languageModelHead().weightsCopy()[0];

        trainer.trainExample("abab");

        assertFalse(Arrays.equals(queryBefore, head.queryProjection().weightsCopy()[0]));
        assertFalse(Arrays.equals(keyBefore, head.keyProjection().weightsCopy()[0]));
        assertFalse(Arrays.equals(valueBefore, head.valueProjection().weightsCopy()[0]));
        assertFalse(Arrays.equals(embeddingBefore, model.tokenEmbeddings().weightsCopy()[4]));
        assertFalse(Arrays.equals(lmHeadBefore, model.languageModelHead().weightsCopy()[0]));
        assertArrayEquals(new double[]{0, 0, 0, 0}, model.tokenEmbeddings().weightsCopy()[0], 0.0);
    }

    @Test
    void shouldComputeFiniteGradientAndClipIt() {
        FullModelTrainer trainer = new FullModelTrainer(tinyModel(), 0.001, 0.0, 0.01);
        TrainingMetrics metrics = trainer.trainExample("abab");
        assertEquals(5, metrics.targetCount()); // a b a b EOS
        assertTrue(metrics.lossBefore() > 0 && Double.isFinite(metrics.lossBefore()));
        assertTrue(metrics.gradientNorm() > 0 && Double.isFinite(metrics.gradientNorm()));
        assertTrue(metrics.gradientScale() < 1.0);
    }

    @Test
    void shouldNotUpdateAnyParametersWhenEvaluating() {
        JarvisLanguageModel model = tinyModel();
        FullModelTrainer trainer = new FullModelTrainer(model, 0.01, 0.0, 1.0);
        double[][] before = model.languageModelHead().weightsCopy();
        double first = trainer.evaluateExample("ab");
        double second = trainer.evaluateExample("ab");
        assertEquals(first, second, 0.0);
        for (int i = 0; i < before.length; i++) {
            assertArrayEquals(before[i], model.languageModelHead().weightsCopy()[i], 0.0);
        }
    }

    @Test
    void shouldRejectUnknownTokenAndOversizedContext() {
        FullModelTrainer trainer = new FullModelTrainer(tinyModel(), 0.007, 0.0, 1.0);
        assertThrows(IllegalArgumentException.class, () -> trainer.trainExample("z"));
        assertThrows(IllegalArgumentException.class, () -> trainer.trainExample("a".repeat(16)));
        assertThrows(IllegalArgumentException.class, () -> trainer.trainEpoch(List.of()));
    }

    @Test
    void shouldSupportMultipleExamplesAndEosTarget() {
        FullModelTrainer trainer = new FullModelTrainer(tinyModel(), 0.007, 0.0, 1.0);
        TrainingMetrics result = trainer.trainExample("");
        assertEquals(1, result.targetCount()); // BOS -> EOS
        assertTrue(Double.isFinite(trainer.trainEpoch(List.of("ab", "ba"))));
    }
}
