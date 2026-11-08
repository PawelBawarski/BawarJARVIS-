
package pl.bawar.jarvis.brain.model;

import pl.bawar.jarvis.brain.embedding.EmbeddingLayer;
import pl.bawar.jarvis.brain.embedding.PositionalEmbedding;
import pl.bawar.jarvis.brain.layers.DenseLayer;
import pl.bawar.jarvis.brain.math.MatrixOps;
import pl.bawar.jarvis.brain.normalization.LayerNormalization;
import pl.bawar.jarvis.brain.tokenizer.CharTokenizer;
import pl.bawar.jarvis.brain.transformer.TransformerBlock;

import java.util.Arrays;
import java.util.List;

public final class JarvisLanguageModel {

    private final CharTokenizer tokenizer;
    private final EmbeddingLayer tokenEmbeddings;
    private final PositionalEmbedding positionalEmbeddings;

    private final List<TransformerBlock> blocks;

    private final LayerNormalization finalNorm;
    private final DenseLayer languageModelHead;

    public JarvisLanguageModel(
            CharTokenizer tokenizer,
            EmbeddingLayer tokenEmbeddings,
            PositionalEmbedding positionalEmbeddings,
            List<TransformerBlock> blocks,
            LayerNormalization finalNorm,
            DenseLayer languageModelHead) {
        if (tokenizer == null ||
                tokenEmbeddings == null ||
                positionalEmbeddings == null ||
                blocks == null ||
                blocks.isEmpty() ||
                finalNorm == null ||
                languageModelHead == null) {
            throw new IllegalArgumentException(
                    "Language model components cannot be null or empty");
        }

        int embeddingSize = tokenEmbeddings.embeddingSize();
        int vocabularySize = tokenizer.vocabularySize();

        if (tokenEmbeddings.vocabularySize() != vocabularySize ||
                positionalEmbeddings.embeddingSize() != embeddingSize ||
                finalNorm.embeddingSize() != embeddingSize ||
                languageModelHead.inputSize() != embeddingSize ||
                languageModelHead.outputSize() != vocabularySize) {
            throw new IllegalArgumentException(
                    "Incompatible language model dimensions");
        }

        for (TransformerBlock block : blocks) {
            if (block == null ||
                    block.embeddingSize() != embeddingSize) {
                throw new IllegalArgumentException(
                        "Invalid Transformer Block dimensions");
            }
        }

        this.tokenizer = tokenizer;
        this.tokenEmbeddings = tokenEmbeddings;
        this.positionalEmbeddings = positionalEmbeddings;
        this.blocks = List.copyOf(blocks);
        this.finalNorm = finalNorm;
        this.languageModelHead = languageModelHead;
    }

    public double[] nextTokenProbabilities(String prompt) {

        // 1. Tekst -> tokeny (BOS, bez EOS).
        int[] tokenIds = tokenizer.encodePrompt(prompt);

        if (tokenIds.length > positionalEmbeddings.maxSequenceLength()) {
            throw new IllegalArgumentException(
                    "Prompt exceeds maximum context length");
        }

        // 2. Tokeny -> wektory liczb.
        double[][] hidden = tokenEmbeddings.forward(tokenIds);

        // 3. Dodajemy informację o pozycji.
        hidden = positionalEmbeddings.forward(hidden);

        // 4. Przechodzimy przez bloki Transformera.
        for (TransformerBlock block : blocks) {
            hidden = block.forward(hidden);
        }

        // 5. Końcowa normalizacja.
        hidden = finalNorm.forward(hidden);

        // 6. Interesuje nas ostatnia pozycja.
        double[] lastToken = hidden[hidden.length - 1];

        // 7. Wektor -> logity całego słownika.
        double[] logits = languageModelHead.forward(lastToken);

        // PAD, UNK i BOS nie są kandydatami
        // na kolejny token podczas generowania.
        // EOS pozostaje dozwolony.
        double[] allowedLogits = Arrays.copyOfRange(
                logits,
                CharTokenizer.EOS,
                logits.length);

        // 8. Logity -> prawdopodobieństwa.
        double[] allowedProbabilities = MatrixOps.softmax(allowedLogits);

        double[] probabilities = new double[logits.length];

        System.arraycopy(
                allowedProbabilities,
                0,
                probabilities,
                CharTokenizer.EOS,
                allowedProbabilities.length);

        return probabilities;
    }

    public int predictNextTokenId(String prompt) {

        double[] probabilities = nextTokenProbabilities(prompt);

        int bestToken = CharTokenizer.EOS;

        for (int i = CharTokenizer.EOS + 1; i < probabilities.length; i++) {

            if (probabilities[i] > probabilities[bestToken]) {
                bestToken = i;
            }
        }

        return bestToken;
    }

    public String predictNextToken(String prompt) {

        int tokenId = predictNextTokenId(prompt);

        if (tokenId == CharTokenizer.EOS) {
            return "<EOS>";
        }

        return tokenizer.decode(new int[] { tokenId });
    }

    public int vocabularySize() {
        return tokenizer.vocabularySize();
    }

    public int contextLength() {
        return positionalEmbeddings.maxSequenceLength();
    }
}
