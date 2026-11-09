package pl.bawar.jarvis.runtime;

public record TrainingSummary(
        int epochs,
        int examplesProcessed,
        double lastEpochLoss
) { }
