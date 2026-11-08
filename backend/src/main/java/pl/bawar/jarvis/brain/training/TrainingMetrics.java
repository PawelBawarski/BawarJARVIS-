package pl.bawar.jarvis.brain.training;

/** Metrics of one online (one sequence) next-token update. */
public record TrainingMetrics(double lossBefore, int targetCount,
                              double gradientNorm, double gradientScale) { }
