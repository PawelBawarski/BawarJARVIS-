package pl.bawar.jarvis.brain.training;

/** Result of bounded autoregressive generation; text includes the original prompt. */
public record GenerationResult(String text, int generatedTokens, boolean stoppedByEos) { }
