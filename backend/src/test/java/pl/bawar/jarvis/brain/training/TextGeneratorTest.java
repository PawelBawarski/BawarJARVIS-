package pl.bawar.jarvis.brain.training;

import org.junit.jupiter.api.Test;
import pl.bawar.jarvis.brain.model.JarvisLanguageModel;
import pl.bawar.jarvis.brain.tokenizer.CharTokenizer;

import java.util.Random;

import static org.junit.jupiter.api.Assertions.*;

class TextGeneratorTest {
    @Test
    void shouldGenerateGreedyCharactersWithTokenLimit() {
        JarvisLanguageModel model = TinyTestModels.create("abab", 42);
        int a = model.tokenizer().encodePrompt("a")[1];
        forceHeadToken(model, a);
        GenerationResult result = new TextGenerator(model).generate("a", 3, 0, 10L);
        assertEquals("aaaa", result.text());
        assertEquals(3, result.generatedTokens());
        assertFalse(result.stoppedByEos());
    }

    @Test
    void shouldStopAtEos() {
        JarvisLanguageModel model = TinyTestModels.create("abab", 42);
        forceHeadToken(model, CharTokenizer.EOS);
        GenerationResult result = new TextGenerator(model).generate("ab", 5, 0, 11);
        assertEquals("ab", result.text());
        assertEquals(0, result.generatedTokens());
        assertTrue(result.stoppedByEos());
    }

    @Test
    void shouldRejectUnknownInputAndInvalidTemperature() {
        TextGenerator generator = new TextGenerator(TinyTestModels.create("abab", 42));
        assertThrows(IllegalArgumentException.class, () -> generator.generate("z", 2, 0, 42));
        assertThrows(IllegalArgumentException.class, () -> generator.generate("a", 2, -1, 42));
        assertThrows(IllegalArgumentException.class, () -> generator.generate("a", -1, 1, 42));
        assertThrows(IllegalArgumentException.class, () -> generator.generate("a".repeat(16), 2, 0, 42));
    }

    @Test
    void shouldBeDeterministicForSameSeed() {
        TextGenerator generator = new TextGenerator(TinyTestModels.create("abab", 42));
        GenerationResult first = generator.generate("a", 4, 0.8, 123);
        GenerationResult second = generator.generate("a", 4, 0.8, 123);
        assertEquals(first, second);
    }

    private static void forceHeadToken(JarvisLanguageModel model, int target) {
        int n = model.languageModelHead().inputSize();
        int vocabularySize = model.vocabularySize();
        double[][] weights = new double[n][vocabularySize];
        double[] biases = new double[vocabularySize];
        biases[target] = 100;
        model.languageModelHead().replaceParameters(weights, biases);
    }
}
