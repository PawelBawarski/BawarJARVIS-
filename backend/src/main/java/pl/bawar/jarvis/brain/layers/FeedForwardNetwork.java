
package pl.bawar.jarvis.brain.layers;

import pl.bawar.jarvis.brain.activation.GeluActivation;

public final class FeedForwardNetwork {

    private final DenseLayer inputLayer;
    private final DenseLayer outputLayer;

    private final int embeddingSize;
    private final int hiddenSize;

    public FeedForwardNetwork(
            DenseLayer inputLayer,
            DenseLayer outputLayer) {
        if (inputLayer == null || outputLayer == null) {
            throw new IllegalArgumentException(
                    "FFN layers cannot be null");
        }

        int inputSize = inputLayer.inputSize();
        int hiddenSize = inputLayer.outputSize();

        // Pierwsza warstwa: embeddingSize -> hiddenSize
        // Druga warstwa: hiddenSize -> embeddingSize
        if (outputLayer.inputSize() != hiddenSize ||
                outputLayer.outputSize() != inputSize) {
            throw new IllegalArgumentException(
                    "Incompatible FFN layer dimensions");
        }

        this.inputLayer = inputLayer;
        this.outputLayer = outputLayer;

        this.embeddingSize = inputSize;
        this.hiddenSize = hiddenSize;
    }

    public double[] forward(double[] input) {

        if (input == null || input.length != embeddingSize) {
            throw new IllegalArgumentException(
                    "Invalid FFN input dimensions");
        }

        // 1. Rozszerzamy wektor.
        double[] hidden = inputLayer.forward(input);

        // 2. Dodajemy nieliniowość.
        double[] activated = GeluActivation.apply(hidden);

        // 3. Przywracamy rozmiar embeddingu.
        return outputLayer.forward(activated);
    }

    public double[][] forward(double[][] input) {

        if (input == null || input.length == 0) {
            throw new IllegalArgumentException(
                    "FFN input matrix cannot be null or empty");
        }

        double[][] output = new double[input.length][embeddingSize];

        // Każdy token przetwarzamy niezależnie,
        // ale korzystamy z tych samych wag.
        for (int i = 0; i < input.length; i++) {
            output[i] = forward(input[i]);
        }

        return output;
    }

    public int embeddingSize() {
        return embeddingSize;
    }

    public int hiddenSize() {
        return hiddenSize;
    }
}
