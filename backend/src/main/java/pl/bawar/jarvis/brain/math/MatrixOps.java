package pl.bawar.jarvis.brain.math;

public final class MatrixOps {

    private MatrixOps() {
        // Nie tworzymy obiektów tej klasy.
    }

    public static double[][] multiply(
            double[][] a,
            double[][] b) {
        int aColumns = validateMatrix(a);
        int bColumns = validateMatrix(b);

        if (aColumns != b.length) {
            throw new IllegalArgumentException(
                    "Incompatible matrix dimensions");
        }

        int rows = a.length;
        int columns = bColumns;

        double[][] result = new double[rows][columns];

        for (int i = 0; i < rows; i++) {
            for (int j = 0; j < columns; j++) {
                for (int k = 0; k < aColumns; k++) {
                    result[i][j] += a[i][k] * b[k][j];
                }
            }
        }

        return result;
    }

    private static int validateMatrix(double[][] matrix) {
        if (matrix == null ||
                matrix.length == 0 ||
                matrix[0] == null ||
                matrix[0].length == 0) {
            throw new IllegalArgumentException(
                    "Matrix cannot be null or empty");
        }

        int columns = matrix[0].length;

        for (double[] row : matrix) {
            if (row == null || row.length != columns) {
                throw new IllegalArgumentException(
                        "Matrix must be rectangular");
            }
        }

        return columns;
    }

    public static double[] softmax(double[] values) {

        if (values == null || values.length == 0) {
            throw new IllegalArgumentException(
                    "Values cannot be null or empty");
        }

        // Krok 1: Znajdź największą wartość.
        double max = Double.NEGATIVE_INFINITY;

        for (double value : values) {
            if (!Double.isFinite(value)) {
                throw new IllegalArgumentException(
                        "Values must be finite");
            }

            max = Math.max(max, value);
        }

        // Krok 2: Oblicz funkcję wykładniczą.
        double[] result = new double[values.length];

        double sum = 0.0;

        for (int i = 0; i < values.length; i++) {
            result[i] = Math.exp(values[i] - max);
            sum += result[i];
        }

        // Krok 3: Podziel każdą wartość przez sumę.
        for (int i = 0; i < result.length; i++) {
            result[i] /= sum;
        }

        return result;
    }
}
