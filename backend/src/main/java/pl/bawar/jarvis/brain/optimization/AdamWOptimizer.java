package pl.bawar.jarvis.brain.optimization;

/**
 * AdamW dla jednego wektora parametrów (np. wiersza macierzy wag lub biasów).
 * Każdy niezależny wektor parametrów wymaga własnej instancji optymalizatora.
 */
public final class AdamWOptimizer {
    private static final double BETA1 = 0.9;
    private static final double BETA2 = 0.999;
    private static final double EPSILON = 1e-8;

    private final double learningRate;
    private final double weightDecay;
    private final double[] firstMoment;
    private final double[] secondMoment;
    private long stepCount;

    public AdamWOptimizer(int parameterCount, double learningRate, double weightDecay) {
        if (parameterCount <= 0) {
            throw new IllegalArgumentException("Parameter count must be positive");
        }
        if (!Double.isFinite(learningRate) || learningRate <= 0.0) {
            throw new IllegalArgumentException("Learning rate must be finite and positive");
        }
        if (!Double.isFinite(weightDecay) || weightDecay < 0.0) {
            throw new IllegalArgumentException("Weight decay must be finite and non-negative");
        }
        this.learningRate = learningRate;
        this.weightDecay = weightDecay;
        this.firstMoment = new double[parameterCount];
        this.secondMoment = new double[parameterCount];
    }

    public void step(double[] parameters, double[] gradients) {
        if (parameters == null || gradients == null ||
                parameters.length != firstMoment.length ||
                gradients.length != firstMoment.length) {
            throw new IllegalArgumentException("Invalid parameter or gradient dimensions");
        }
        for (int i = 0; i < parameters.length; i++) {
            if (!Double.isFinite(parameters[i]) || !Double.isFinite(gradients[i])) {
                throw new IllegalArgumentException("Parameters and gradients must be finite");
            }
        }
        if (stepCount == Long.MAX_VALUE) {
            throw new IllegalStateException("Optimizer step counter overflow");
        }

        stepCount++;
        double correction1 = 1.0 - Math.pow(BETA1, stepCount);
        double correction2 = 1.0 - Math.pow(BETA2, stepCount);

        for (int i = 0; i < parameters.length; i++) {
            double gradient = gradients[i];
            firstMoment[i] = BETA1 * firstMoment[i] + (1.0 - BETA1) * gradient;
            secondMoment[i] = BETA2 * secondMoment[i] + (1.0 - BETA2) * gradient * gradient;

            double correctedFirstMoment = firstMoment[i] / correction1;
            double correctedSecondMoment = secondMoment[i] / correction2;

            // Decoupled weight decay: oddzielony od adaptacyjnego kroku Adama.
            double decayed = parameters[i] * (1.0 - learningRate * weightDecay);
            double adaptiveUpdate = learningRate * correctedFirstMoment /
                    (Math.sqrt(correctedSecondMoment) + EPSILON);
            double updated = decayed - adaptiveUpdate;
            if (!Double.isFinite(updated)) {
                throw new ArithmeticException("Non-finite parameter update");
            }
            parameters[i] = updated;
        }
    }

    public long stepCount() {
        return stepCount;
    }

    /** State used to resume AdamW without losing momentum and step counter. */
    public AdamWState snapshot() {
        return new AdamWState(stepCount, firstMoment, secondMoment);
    }

    public void restore(AdamWState state) {
        if (state == null || state.size() != firstMoment.length) {
            throw new IllegalArgumentException("Incompatible AdamW state");
        }
        double[] first = state.first(), second = state.second();
        System.arraycopy(first, 0, firstMoment, 0, first.length);
        System.arraycopy(second, 0, secondMoment, 0, second.length);
        stepCount = state.steps();
    }

}
