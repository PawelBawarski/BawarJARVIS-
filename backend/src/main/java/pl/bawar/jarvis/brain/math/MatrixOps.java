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
}
