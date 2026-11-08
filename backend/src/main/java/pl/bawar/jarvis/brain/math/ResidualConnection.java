
package pl.bawar.jarvis.brain.math;

public final class ResidualConnection {

    private ResidualConnection() {
        // Klasa narzędziowa.
    }

    public static double[][] add(
            double[][] original,
            double[][] transformed) {
        if (original == null ||
                transformed == null ||
                original.length == 0 ||
                original.length != transformed.length) {
            throw new IllegalArgumentException(
                    "Matrices must have matching dimensions");
        }

        double[][] result = new double[original.length][];

        for (int i = 0; i < original.length; i++) {

            if (original[i] == null ||
                    transformed[i] == null ||
                    original[i].length == 0 ||
                    original[i].length != transformed[i].length) {
                throw new IllegalArgumentException(
                        "Matrix rows must have matching dimensions");
            }

            result[i] = new double[original[i].length];

            for (int j = 0; j < original[i].length; j++) {

                double a = original[i][j];
                double b = transformed[i][j];

                if (!Double.isFinite(a) ||
                        !Double.isFinite(b)) {
                    throw new IllegalArgumentException(
                            "Matrix values must be finite");
                }

                double sum = a + b;

                if (!Double.isFinite(sum)) {
                    throw new IllegalArgumentException(
                            "Residual sum must be finite");
                }

                result[i][j] = sum;
            }
        }

        return result;
    }
}
