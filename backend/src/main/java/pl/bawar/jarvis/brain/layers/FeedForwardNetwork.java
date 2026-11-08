package pl.bawar.jarvis.brain.layers;

import pl.bawar.jarvis.brain.activation.GeluActivation;

public final class FeedForwardNetwork {

    private final DenseLayer inputLayer;
    private final DenseLayer outputLayer;

    private final int embeddingSize;
    private final int hiddenSize;

    public FeedForwardNetwork(DenseLayer inputLayer, DenseLayer outputLayer) {
        if (inputLayer == null || outputLayer == null) {
            throw new IllegalArgumentException("FFN layers cannot be null");
        }

        int inputSize = inputLayer.inputSize();
        int innerSize = inputLayer.outputSize();
        if (outputLayer.inputSize() != innerSize
                || outputLayer.outputSize() != inputSize) {
            throw new IllegalArgumentException("Incompatible FFN layer dimensions");
        }

        this.inputLayer = inputLayer;
        this.outputLayer = outputLayer;
        this.embeddingSize = inputSize;
        this.hiddenSize = innerSize;
    }

    public double[] forward(double[] input) {
        if (input == null || input.length != embeddingSize) {
            throw new IllegalArgumentException("Invalid FFN input dimensions");
        }
        double[] hidden = inputLayer.forward(input);
        double[] activated = GeluActivation.apply(hidden);
        return outputLayer.forward(activated);
    }

    public double[][] forward(double[][] input) {
        if (input == null || input.length == 0) {
            throw new IllegalArgumentException("FFN input matrix cannot be null or empty");
        }
        double[][] output = new double[input.length][embeddingSize];
        for (int i = 0; i < input.length; i++) {
            output[i] = forward(input[i]);
        }
        return output;
    }

    /**
     * Chain rule: Dense2 -> GELU -> Dense1.
     * dOutput to gradient dL/d(FFN(x)) otrzymany z nastepnej warstwy.
     * Metoda oblicza gradienty, NIE aktualizuje wag.
     */
    public FeedForwardGradients backward(double[] input, double[] dOutput) {
        if (input == null || input.length != embeddingSize) {
            throw new IllegalArgumentException("Invalid FFN input dimensions");
        }
        if (dOutput == null || dOutput.length != embeddingSize) {
            throw new IllegalArgumentException("Invalid FFN output gradient dimensions");
        }

        // Powtarzamy forward, aby odtworzyc wartosci posrednie do chain rule.
        // W przyszlosci uzyjemy cache z forward zamiast ponownych obliczen.
        double[] hidden = inputLayer.forward(input);
        double[] activated = GeluActivation.apply(hidden);

        // Gradienty drugiej warstwy i pochodna wzgledem wyjscia GELU.
        DenseGradients second = outputLayer.backward(activated, dOutput);

        // Pochodna GELU musi odpowiadac wariantowi uzytemu w forward.
        double[] dHidden = GeluActivation.backward(
                hidden, second.inputGradient());

        // Gradienty pierwszej warstwy oraz gradient do poprzedniej warstwy.
        DenseGradients first = inputLayer.backward(input, dHidden);

        return new FeedForwardGradients(
                first.inputGradient(), first, second);
    }

    /**
     * Backpropagation przez sekwencje tokenow z WSPOLNYMI parametrami FFN.
     * Gradienty wag i biasow sumujemy; gradient kazdego wejscia jest osobny.
     */
    public FeedForwardBatchGradients backward(
            double[][] inputs,
            double[][] outputGradients) {

        if (inputs == null || inputs.length == 0
                || outputGradients == null
                || outputGradients.length != inputs.length) {
            throw new IllegalArgumentException("Invalid FFN batch dimensions");
        }

        double[][] dInputs = new double[inputs.length][];
        double[][] dW1 = new double[embeddingSize][hiddenSize];
        double[] dB1 = new double[hiddenSize];
        double[][] dW2 = new double[hiddenSize][embeddingSize];
        double[] dB2 = new double[embeddingSize];

        for (int t = 0; t < inputs.length; t++) {
            FeedForwardGradients token = backward(inputs[t], outputGradients[t]);
            dInputs[t] = token.inputGradient();

            addMatrix(dW1, token.inputLayerGradients().weightGradients());
            addVector(dB1, token.inputLayerGradients().biasGradients());
            addMatrix(dW2, token.outputLayerGradients().weightGradients());
            addVector(dB2, token.outputLayerGradients().biasGradients());
        }
        return new FeedForwardBatchGradients(dInputs, dW1, dB1, dW2, dB2);
    }

    private static void addMatrix(double[][] sum, double[][] increment) {
        for (int i = 0; i < sum.length; i++) {
            for (int j = 0; j < sum[i].length; j++) {
                sum[i][j] += increment[i][j];
            }
        }
    }

    private static void addVector(double[] sum, double[] increment) {
        for (int i = 0; i < sum.length; i++) {
            sum[i] += increment[i];
        }
    }

    public int embeddingSize() {
        return embeddingSize;
    }

    public int hiddenSize() {
        return hiddenSize;
    }
}
