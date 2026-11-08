
package pl.bawar.jarvis.brain.loss;

public final class CrossEntropyLoss {

    private CrossEntropyLoss() {
        // Klasa narzędziowa.
    }

    public static double calculate(
            double[] logits,
            int targetIndex) {
        if (logits == null || logits.length == 0) {
            throw new IllegalArgumentException(
                    "Logits cannot be null or empty");
        }

        if (targetIndex < 0 || targetIndex >= logits.length) {
            throw new IllegalArgumentException(
                    "Target index is out of range");
        }

        double maxLogit = Double.NEGATIVE_INFINITY;

        for (double logit : logits) {
            if (!Double.isFinite(logit)) {
                throw new IllegalArgumentException(
                        "Logits must contain finite numbers");
            }

            maxLogit = Math.max(maxLogit, logit);
        }

        double sumExp = 0.0;

        for (double logit : logits) {
            sumExp += Math.exp(logit - maxLogit);
        }

        return Math.log(sumExp)
                + (maxLogit - logits[targetIndex]);
    }
}
