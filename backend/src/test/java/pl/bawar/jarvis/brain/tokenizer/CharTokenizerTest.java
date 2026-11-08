
package pl.bawar.jarvis.brain.tokenizer;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class CharTokenizerTest {

    @Test
    void shouldEncodeCharacters() {
        CharTokenizer tokenizer = new CharTokenizer("ab");

        int[] result = tokenizer.encode("ba");

        assertArrayEquals(
                new int[] { 2, 5, 4, 3 },
                result);
    }

    @Test
    void shouldDecodeCharacters() {
        CharTokenizer tokenizer = new CharTokenizer("ab");

        String result = tokenizer.decode(
                new int[] { 2, 5, 4, 3 });

        assertEquals("ba", result);
    }

    @Test
    void shouldSupportPolishAndEmoji() {
        String text = "Zażółć gęślą jaźń 🧠";

        CharTokenizer tokenizer = new CharTokenizer(text);

        int[] encoded = tokenizer.encode(text);
        String decoded = tokenizer.decode(encoded);

        assertEquals(text, decoded);

        assertEquals(
                text.codePointCount(0, text.length()) + 2,
                encoded.length);
    }

    @Test
    void shouldUseUnknownToken() {
        CharTokenizer tokenizer = new CharTokenizer("ab");

        int[] result = tokenizer.encode("c");

        assertArrayEquals(
                new int[] { 2, CharTokenizer.UNK, 3 },
                result);

        assertEquals("\uFFFD", tokenizer.decode(result));
    }

    @Test
    void shouldReturnVocabularySize() {
        CharTokenizer tokenizer = new CharTokenizer("aabb");

        assertEquals(6, tokenizer.vocabularySize());
    }

    @Test
    void shouldRejectInvalidInput() {
        assertThrows(
                IllegalArgumentException.class,
                () -> new CharTokenizer(""));

        CharTokenizer tokenizer = new CharTokenizer("ab");

        assertThrows(
                IllegalArgumentException.class,
                () -> tokenizer.encode(null));

        assertThrows(
                IllegalArgumentException.class,
                () -> tokenizer.decode(new int[] { 999 }));
    }

    @Test
    void shouldEncodePromptWithoutEos() {

        CharTokenizer tokenizer = new CharTokenizer("Ala");

        int[] fullSequence = tokenizer.encode("Ala");
        int[] prompt = tokenizer.encodePrompt("Ala");

        assertEquals(CharTokenizer.BOS, prompt[0]);
        assertEquals(CharTokenizer.EOS,
                fullSequence[fullSequence.length - 1]);

        assertEquals(
                fullSequence.length - 1,
                prompt.length);

        assertArrayEquals(
                java.util.Arrays.copyOf(
                        fullSequence,
                        fullSequence.length - 1),
                prompt);
    }

}
