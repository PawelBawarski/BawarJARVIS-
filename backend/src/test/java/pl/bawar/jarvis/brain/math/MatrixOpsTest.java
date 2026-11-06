package pl.bawar.jarvis.brain.math;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class MatrixOpsTest {

    @Test
    void shouldMultiplyTwoMatrices() {
        // Arrange
        double[][] a = {
                { 1, 2 },
                { 3, 4 }
        };

        double[][] b = {
                { 5, 6 },
                { 7, 8 }
        };

        // Act
        double[][] result = MatrixOps.multiply(a, b);

        // Assert
        assertArrayEquals(
                new double[] { 19, 22 },
                result[0],
                0.000001);

        assertArrayEquals(
                new double[] { 43, 50 },
                result[1],
                0.000001);
    }

    @Test
    void shouldRejectInvalidDimensions() {
        double[][] a = {
                { 1, 2, 3 }
        };

        double[][] b = {
                { 4, 5 }
        };

        assertThrows(
                IllegalArgumentException.class,
                () -> MatrixOps.multiply(a, b));
    }

    @Test
    void shouldRejectNonRectangularMatrix() {
        double[][] a = {
                { 1, 2 },
                { 3 }
        };

        double[][] b = {
                { 1 },
                { 2 }
        };

        assertThrows(
                IllegalArgumentException.class,
                () -> MatrixOps.multiply(a, b));
    }
}
