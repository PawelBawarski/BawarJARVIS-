package pl.bawar.jarvis.brain.optimization;

/** Immutable snapshot of one AdamW parameter vector. */
public record AdamWState(long steps, double[] first, double[] second) {
    public AdamWState {
        if (steps < 0 || first == null || second == null || first.length == 0
                || first.length != second.length) {
            throw new IllegalArgumentException("Invalid AdamW state shape");
        }
        first = first.clone();
        second = second.clone();
        for (int i = 0; i < first.length; i++) {
            if (!Double.isFinite(first[i]) || !Double.isFinite(second[i]) || second[i] < 0) {
                throw new IllegalArgumentException("Invalid AdamW moment");
            }
        }
    }
    @Override public double[] first() { return first.clone(); }
    @Override public double[] second() { return second.clone(); }
    public int size() { return first.length; }
}
