
package pl.bawar.jarvis.brain.layers;

import pl.bawar.jarvis.brain.math.MatrixOps;

import java.util.Arrays;

public final class DenseLayer {

    private final double[][] weights;
    private final double[] biases;

    public DenseLayer(
            double[][] weights,
            double[] biases) {
        if (weights == null || weights.length == 0) {
            throw new IllegalArgumentException(
                    "Weights cannot be null or empty");
        }

        if (biases == null || biases.length == 0) {
            throw new IllegalArgumentException(
                    "Biases cannot be null or empty");
        }

        int outputSize = biases.length;

        this.weights = new double[weights.length][outputSize];

        for (int i = 0; i < weights.length; i++) {
            if (weights[i] == null ||
                    weights[i].length != outputSize) {
                throw new IllegalArgumentException(
                        "Invalid weight matrix dimensions");
            }

            for (int j = 0; j < outputSize; j++) {
                if (!Double.isFinite(weights[i][j])) {
                    throw new IllegalArgumentException(
                            "Weights must be finite");
                }

                this.weights[i][j] = weights[i][j];
            }
        }

        for (double bias : biases) {
            if (!Double.isFinite(bias)) {
                throw new IllegalArgumentException(
                        "Biases must be finite");
            }
        }

        this.biases = Arrays.copyOf(
                biases,
                biases.length);
    }

    public double[] forward(double[] input) {
        if (input == null ||
                input.length != weights.length) {
            throw new IllegalArgumentException(
                    "Invalid input dimensions");
        }

        for (double value : input) {
            if (!Double.isFinite(value)) {
                throw new IllegalArgumentException(
                        "Input values must be finite");
            }
        }

        // Zamieniamy wektor na macierz z jednym wierszem.
        double[][] inputMatrix = { input };

        // Obliczamy X * W.
        double[][] result = MatrixOps.multiply(
                inputMatrix,
                weights);

        // Dodajemy bias do każdego neuronu wyjściowego.
        for (int j = 0; j < biases.length; j++) {
            result[0][j] += biases[j];
        }

        return result[0];
    }

    public int inputSize() {
        return weights.length;
    }

    public int outputSize() {
        return biases.length;
    }

    public DenseGradients backward(
            double[] input,
            double[] outputGradient) {
        // 1. Sprawdzamy wymiary.
        if (input == null || input.length != inputSize()) {
            throw new IllegalArgumentException(
                    "Invalid input dimensions");
        }

        if (outputGradient == null ||
                outputGradient.length != outputSize()) {
            throw new IllegalArgumentException(
                    "Invalid output gradient dimensions");
        }

        // 2. Sprawdzamy poprawność liczb.
        for (double value : input) {
            if (!Double.isFinite(value)) {
                throw new IllegalArgumentException(
                        "Input must contain finite numbers");
            }
        }

        for (double value : outputGradient) {
            if (!Double.isFinite(value)) {
                throw new IllegalArgumentException(
                        "Gradient must contain finite numbers");
            }
        }

        // 3. Przygotowujemy wynikowe gradienty.
        double[] inputGradient = new double[inputSize()];

        double[][] weightGradients = new double[inputSize()][outputSize()];

        double[] biasGradients = outputGradient.clone();

        // 4. Reguła łańcuchowa dla DenseLayer.
        for (int i = 0; i < inputSize(); i++) {
            for (int j = 0; j < outputSize(); j++) {

                // dL/dW = wejście * gradient wyjścia
                weightGradients[i][j] = input[i] * outputGradient[j];

                // dL/dx = suma(W * gradient wyjścia)
                inputGradient[i] += weights[i][j] * outputGradient[j];
            }
        }

        return new DenseGradients(
                inputGradient,
                weightGradients,
                biasGradients);
    }
}
