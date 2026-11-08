package pl.bawar.jarvis.brain.training;

/** Corpus-wide token-weighted evaluation (no training or optimizer updates). */
public record EvaluationMetrics(double meanCrossEntropy, double perplexity, long targetTokens) { }
