
package pl.bawar.jarvis.brain.tokenizer;

import java.util.HashMap;
import java.util.Map;
import java.util.Arrays;

public final class CharTokenizer {

    public static final int PAD = 0;
    public static final int UNK = 1;
    public static final int BOS = 2;
    public static final int EOS = 3;

    private static final int FIRST_CHARACTER_ID = 4;

    private final Map<Integer, Integer> tokenIds = new HashMap<>();

    private final int[] vocabulary;

    public CharTokenizer(String trainingText) {

        if (trainingText == null || trainingText.isEmpty()) {
            throw new IllegalArgumentException(
                    "Training text cannot be null or empty");
        }

        // Budujemy słownik unikalnych znaków Unicode.
        vocabulary = trainingText
                .codePoints()
                .distinct()
                .sorted()
                .toArray();

        // Przypisujemy każdemu znakowi jego ID.
        for (int i = 0; i < vocabulary.length; i++) {
            tokenIds.put(
                    vocabulary[i],
                    FIRST_CHARACTER_ID + i);
        }
    }

    public int[] encodePrompt(String text) {

        if (text == null) {
            throw new IllegalArgumentException(
                    "Text cannot be null");
        }

        int[] characters = text.codePoints().toArray();

        // BOS + znaki tekstu, bez EOS.
        int[] result = new int[characters.length + 1];

        result[0] = BOS;

        for (int i = 0; i < characters.length; i++) {
            result[i + 1] = tokenIds.getOrDefault(
                    characters[i],
                    UNK);
        }

        return result;
    }

    public int[] encode(String text) {

        int[] promptTokens = encodePrompt(text);

        // Dane treningowe zawierają również EOS.
        int[] result = Arrays.copyOf(
                promptTokens,
                promptTokens.length + 1);

        result[result.length - 1] = EOS;

        return result;
    }

    public String decode(int[] tokenIds) {

        if (tokenIds == null) {
            throw new IllegalArgumentException(
                    "Token IDs cannot be null");
        }

        StringBuilder result = new StringBuilder();

        for (int tokenId : tokenIds) {

            if (tokenId == PAD ||
                    tokenId == BOS ||
                    tokenId == EOS) {
                continue;
            }

            if (tokenId == UNK) {
                result.append('\uFFFD');
                continue;
            }

            int index = tokenId - FIRST_CHARACTER_ID;

            if (index < 0 || index >= vocabulary.length) {
                throw new IllegalArgumentException(
                        "Unknown token ID: " + tokenId);
            }

            result.appendCodePoint(vocabulary[index]);
        }

        return result.toString();
    }

    public int vocabularySize() {
        return vocabulary.length + FIRST_CHARACTER_ID;
    }
}
