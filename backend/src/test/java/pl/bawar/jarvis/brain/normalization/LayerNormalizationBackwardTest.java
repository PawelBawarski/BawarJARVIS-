package pl.bawar.jarvis.brain.normalization;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class LayerNormalizationBackwardTest {

    @Test
    void shouldMatchNumericalGradientsForInputGammaAndBeta() {
        LayerNormalization layer = new LayerNormalization(3, 1e-5);
        double[] gamma = {0.8, 1.3, -0.7};
        double[] beta = {0.1, -0.2, 0.05};
        layer.setAffineParameters(gamma, beta);

        double[] input = {-0.7, 0.3, 1.1};
        double[] upstream = {0.4, -0.2, 0.8};
        LayerNormGradients gradients = layer.backward(input, upstream);
        double h = 1e-6;

        for (int i = 0; i < input.length; i++) {
            double[] plus = input.clone();
            double[] minus = input.clone();
            plus[i] += h;
            minus[i] -= h;
            double numerical = (dot(layer.forward(plus), upstream)
                    - dot(layer.forward(minus), upstream)) / (2 * h);
            assertEquals(numerical, gradients.inputGradient()[i], 1e-6);
        }

        for (int i = 0; i < gamma.length; i++) {
            double[] plus = gamma.clone();
            double[] minus = gamma.clone();
            plus[i] += h;
            minus[i] -= h;
            layer.setAffineParameters(plus, beta);
            double lossPlus = dot(layer.forward(input), upstream);
            layer.setAffineParameters(minus, beta);
            double lossMinus = dot(layer.forward(input), upstream);
            double numerical = (lossPlus - lossMinus) / (2 * h);
            assertEquals(numerical, gradients.gammaGradient()[i], 1e-6);
        }
        layer.setAffineParameters(gamma, beta);

        for (int i = 0; i < beta.length; i++) {
            double[] plus = beta.clone();
            double[] minus = beta.clone();
            plus[i] += h;
            minus[i] -= h;
            layer.setAffineParameters(gamma, plus);
            double lossPlus = dot(layer.forward(input), upstream);
            layer.setAffineParameters(gamma, minus);
            double lossMinus = dot(layer.forward(input), upstream);
            double numerical = (lossPlus - lossMinus) / (2 * h);
            assertEquals(numerical, gradients.betaGradient()[i], 1e-6);
        }
        layer.setAffineParameters(gamma, beta);
    }

    @Test
    void shouldHandleSingleElementVector() {
        LayerNormalization layer = new LayerNormalization(1, 1e-5);
        LayerNormGradients gradients = layer.backward(new double[]{7.0}, new double[]{3.0});
        assertArrayEquals(new double[]{0.0}, gradients.inputGradient(), 1e-12);
        assertArrayEquals(new double[]{0.0}, gradients.gammaGradient(), 1e-12);
        assertArrayEquals(new double[]{3.0}, gradients.betaGradient(), 1e-12);
    }

    @Test
    void shouldKeepInputAndUpstreamGradientUnchanged() {
        LayerNormalization layer = new LayerNormalization(3, 1e-5);
        double[] input = {1.0, 2.0, 4.0};
        double[] upstream = {0.1, -0.2, 0.4};
        layer.backward(input, upstream);
        assertArrayEquals(new double[]{1.0, 2.0, 4.0}, input);
        assertArrayEquals(new double[]{0.1, -0.2, 0.4}, upstream);
    }

    @Test
    void shouldRejectIncorrectGradientAndParameters() {
        LayerNormalization layer = new LayerNormalization(2, 1e-5);
        assertThrows(IllegalArgumentException.class,
                () -> layer.backward(new double[]{1, 2}, new double[]{1}));
        assertThrows(IllegalArgumentException.class,
                () -> layer.setAffineParameters(new double[]{1, Double.NaN}, new double[]{0, 0}));
    }

    private static double dot(double[] a, double[] b) {
        double sum = 0.0;
        for (int i = 0; i < a.length; i++) sum += a[i] * b[i];
        return sum;
    }
}
