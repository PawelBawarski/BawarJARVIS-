package pl.bawar.jarvis.runtime;

/** Immutable snapshot without revealing local filesystem paths to UI clients. */
public record ModelStatus(
        int vocabularySize,
        int contextLength,
        long trainedExamplesThisSession,
        boolean checkpointAvailable,
        boolean restoredFromCheckpoint
) { }
