
package pl.bawar.jarvis.brain.activation;

public final class GeluActivation {

    private static final double SQRT_2_OVER_PI = Math.sqrt(2.0 / Math.PI);

    private static final double COEFFICIENT = 0.044715;

    private GeluActivation() {
        // Nie tworzymy instancji tej klasy.
    }

    public static double apply(double x) {

        if (!Double.isFinite(x)) {
            throw new IllegalArgumentException(
                    "Input must be finite");
        }

        double xCubed = Math.pow(x, 3);

        double inner = SQRT_2_OVER_PI *
                (x + COEFFICIENT * xCubed);

        double tanh = Math.tanh(inner);

        return 0.5 * x * (1.0 + tanh);
    }

    public static double[] apply(double[] inputs) {

        if (inputs == null || inputs.length == 0) {
            throw new IllegalArgumentException(
                    "Inputs cannot be null or empty");
        }

        double[] results = new double[inputs.length];

        for (int i = 0; i < inputs.length; i++) {
            results[i] = apply(inputs[i]);
        }

        return results;
    }
}
