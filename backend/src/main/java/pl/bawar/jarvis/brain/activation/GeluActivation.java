package pl.bawar.jarvis.brain.activation;

public final class GeluActivation {

    private static final double SQRT_2_OVER_PI = Math.sqrt(2.0 / Math.PI);
    private static final double COEFFICIENT = 0.044715;

    private GeluActivation() {
        // Klasa narzędziowa: żadnych instancji.
    }

    public static double apply(double x) {
        if (!Double.isFinite(x)) {
            throw new IllegalArgumentException("Input must be finite");
        }

        double inner = SQRT_2_OVER_PI * (x + COEFFICIENT * x * x * x);
        return 0.5 * x * (1.0 + Math.tanh(inner));
    }

    public static double[] apply(double[] inputs) {
        if (inputs == null || inputs.length == 0) {
            throw new IllegalArgumentException("Inputs cannot be null or empty");
        }

        double[] results = new double[inputs.length];
        for (int i = 0; i < inputs.length; i++) {
            results[i] = apply(inputs[i]);
        }
        return results;
    }

    /** Pochodna tego samego przybliżenia tanh-GELU, którego używa apply(). */
    public static double derivative(double x) {
        if (!Double.isFinite(x)) {
            throw new IllegalArgumentException("Input must be finite");
        }

        // W obszarze nasycenia pochodna jest numerycznie równa 0 lub 1.
        // Odcinamy przed potęgowaniem, żeby uniknąć Infinity * 0 = NaN.
        if (x <= -10.0) return 0.0;
        if (x >= 10.0) return 1.0;

        double inner = SQRT_2_OVER_PI * (x + COEFFICIENT * x * x * x);
        double tanh = Math.tanh(inner);
        double innerDerivative = SQRT_2_OVER_PI *
                (1.0 + 3.0 * COEFFICIENT * x * x);

        return 0.5 * (1.0 + tanh)
                + 0.5 * x * (1.0 - tanh * tanh) * innerDerivative;
    }

    /** dL/dx[i] = dL/dGELU(x[i]) * GELU'(x[i]). */
    public static double[] backward(double[] inputs, double[] outputGradients) {
        if (inputs == null || outputGradients == null || inputs.length == 0
                || inputs.length != outputGradients.length) {
            throw new IllegalArgumentException("Invalid input or gradient dimensions");
        }

        double[] inputGradients = new double[inputs.length];
        for (int i = 0; i < inputs.length; i++) {
            if (!Double.isFinite(outputGradients[i])) {
                throw new IllegalArgumentException("Gradients must be finite");
            }
            inputGradients[i] = outputGradients[i] * derivative(inputs[i]);
        }
        return inputGradients;
    }
}
