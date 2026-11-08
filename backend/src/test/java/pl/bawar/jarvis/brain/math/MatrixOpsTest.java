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

        @Test
        void shouldCalculateSoftmax() {
                // Arrange
                double[] input = { 1.0, 2.0, 3.0 };

                // Act
                double[] result = MatrixOps.softmax(input);

                // Assert
                assertArrayEquals(
                                new double[] {
                                                0.09003057,
                                                0.24472847,
                                                0.66524096
                                },
                                result,
                                0.000001);
        }

        @Test
        void shouldReturnEqualProbabilities() {
                double[] input = { 0.0, 0.0 };

                double[] result = MatrixOps.softmax(input);

                assertArrayEquals(
                                new double[] { 0.5, 0.5 },
                                result,
                                0.000001);
        }

        @Test
        void shouldHandleLargeValues() {
                double[] input = { 1000.0, 1000.0 };

                double[] result = MatrixOps.softmax(input);

                assertArrayEquals(
                                new double[] { 0.5, 0.5 },
                                result,
                                0.000001);
        }

        @Test
        void shouldRejectInvalidValues() {
                assertThrows(
                                IllegalArgumentException.class,
                                () -> MatrixOps.softmax(null));

                assertThrows(
                                IllegalArgumentException.class,
                                () -> MatrixOps.softmax(new double[] {}));

                assertThrows(
                                IllegalArgumentException.class,
                                () -> MatrixOps.softmax(
                                                new double[] { Double.NaN, 2.0 }));
        }

}
