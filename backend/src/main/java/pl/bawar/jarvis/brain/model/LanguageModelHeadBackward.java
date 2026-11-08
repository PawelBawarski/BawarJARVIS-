package pl.bawar.jarvis.brain.model;

import pl.bawar.jarvis.brain.layers.DenseGradients;
import pl.bawar.jarvis.brain.layers.DenseLayer;

/** Collects gradients for one shared LM Head across many token positions. */
public final class LanguageModelHeadBackward {
    private LanguageModelHeadBackward() { }

    public static LanguageModelHeadGradients calculate(
            DenseLayer head,
            double[][] hidden,
            double[][] outputGradients
    ) {
        if (head == null || hidden == null || outputGradients == null
                || hidden.length == 0 || hidden.length != outputGradients.length) {
            throw new IllegalArgumentException("Invalid LM Head inputs");
        }
        int inputSize = head.inputSize();
        int outputSize = head.outputSize();
        double[][] dHidden = new double[hidden.length][inputSize];
        double[][] dWeights = new double[inputSize][outputSize];
        double[] dBias = new double[outputSize];

        for (int t = 0; t < hidden.length; t++) {
            // DenseLayer.backward validates dimensions and finite numbers.
            DenseGradients one = head.backward(hidden[t], outputGradients[t]);
            dHidden[t] = one.inputGradient();
            for (int i = 0; i < inputSize; i++) {
                for (int j = 0; j < outputSize; j++) {
                    dWeights[i][j] += one.weightGradients()[i][j];
                }
            }
            for (int j = 0; j < outputSize; j++) {
                dBias[j] += one.biasGradients()[j];
            }
        }
        return new LanguageModelHeadGradients(dHidden, dWeights, dBias);
    }
}
