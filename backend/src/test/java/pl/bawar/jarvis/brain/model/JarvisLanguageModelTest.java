
package pl.bawar.jarvis.brain.model;

import org.junit.jupiter.api.Test;

import pl.bawar.jarvis.brain.tokenizer.CharTokenizer;

import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.*;

class JarvisLanguageModelTest {

    private static final String VOCABULARY = "Ala ma kota. 🧠";

    private JarvisLanguageModel createModel() {
        return TinyGptFactory.create(
                VOCABULARY,
                42L);
    }

    @Test
    void shouldReturnProbabilityDistribution() {

        JarvisLanguageModel model = createModel();

        double[] probabilities = model.nextTokenProbabilities("Ala");

        assertEquals(
                model.vocabularySize(),
                probabilities.length);

        double sum = Arrays.stream(
                probabilities).sum();

        assertEquals(1.0, sum, 0.000001);

        for (double probability : probabilities) {
            assertTrue(Double.isFinite(probability));
            assertTrue(probability >= 0.0);
            assertTrue(probability <= 1.0);
        }
    }

    @Test
    void shouldExcludeInvalidOutputTokens() {

        JarvisLanguageModel model = createModel();

        double[] probabilities = model.nextTokenProbabilities("Ala");

        assertEquals(
                0.0,
                probabilities[CharTokenizer.PAD]);

        assertEquals(
                0.0,
                probabilities[CharTokenizer.UNK]);

        assertEquals(
                0.0,
                probabilities[CharTokenizer.BOS]);

        // EOS pozostaje prawidłowym kandydatem.
        assertTrue(
                probabilities[CharTokenizer.EOS] > 0.0);
    }

    @Test
    void shouldInitializeModelDeterministically() {

        JarvisLanguageModel first = TinyGptFactory.create(VOCABULARY, 42L);

        JarvisLanguageModel second = TinyGptFactory.create(VOCABULARY, 42L);

        double[] firstResult = first.nextTokenProbabilities("Ala");

        double[] secondResult = second.nextTokenProbabilities("Ala");

        assertArrayEquals(
                firstResult,
                secondResult,
                0.0);
    }

    @Test
    void shouldPredictFirstToken() {

        JarvisLanguageModel model = createModel();

        int tokenId = model.predictNextTokenId(
                "Ala ma");

        String predictedToken = model.predictNextToken(
                "Ala ma");

        assertTrue(tokenId >= CharTokenizer.EOS);
        assertTrue(tokenId < model.vocabularySize());

        assertNotNull(predictedToken);

        System.out.println(
                "JARVIS (untrained) next token: [" +
                        predictedToken + "]");
    }

    @Test
    void shouldRejectTooLongContext() {

        JarvisLanguageModel model = createModel();

        // 128 znaków + BOS = 129 tokenów.
        String prompt = "A".repeat(128);

        assertThrows(
                IllegalArgumentException.class,
                () -> model.nextTokenProbabilities(prompt));
    }

    @Test
    void shouldRejectNullPrompt() {

        JarvisLanguageModel model = createModel();

        assertThrows(
                IllegalArgumentException.class,
                () -> model.nextTokenProbabilities(null));
    }

    @Test
    void shouldAcceptEmptyPromptAsBos() {

        JarvisLanguageModel model = createModel();

        double[] probabilities = model.nextTokenProbabilities("");

        assertEquals(
                model.vocabularySize(),
                probabilities.length);

        assertEquals(
                1.0,
                Arrays.stream(probabilities).sum(),
                0.000001);
    }
}
