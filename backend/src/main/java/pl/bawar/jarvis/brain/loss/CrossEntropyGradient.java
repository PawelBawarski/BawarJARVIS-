
package pl.bawar.jarvis.brain.loss;

public final class CrossEntropyGradient {

    private CrossEntropyGradient() {
        // Klasa narzędziowa.
    }

    public static double[] calculate(
            double[] logits,
            int targetIndex) {
        // 1. Walidacja danych wejściowych.
        if (logits == null || logits.length == 0) {
            throw new IllegalArgumentException(
                    "Logits cannot be null or empty");
        }

        if (targetIndex < 0 || targetIndex >= logits.length) {
            throw new IllegalArgumentException(
                    "Target index is out of range");
        }

        // 2. Znajdujemy największy logit.
        double maxLogit = Double.NEGATIVE_INFINITY;

        for (double logit : logits) {
            if (!Double.isFinite(logit)) {
                throw new IllegalArgumentException(
                        "Logits must contain finite numbers");
            }

            maxLogit = Math.max(maxLogit, logit);
        }

        // 3. Obliczamy stabilny numerycznie Softmax.
        double[] probabilities = new double[logits.length];
        double sumExp = 0.0;

        for (int i = 0; i < logits.length; i++) {
            probabilities[i] = Math.exp(
                    logits[i] - maxLogit);

            sumExp += probabilities[i];
        }

        for (int i = 0; i < probabilities.length; i++) {
            probabilities[i] /= sumExp;
        }

        // 4. Gradient: Softmax - wartość oczekiwana.
        probabilities[targetIndex] -= 1.0;

        return probabilities;
    }
}
