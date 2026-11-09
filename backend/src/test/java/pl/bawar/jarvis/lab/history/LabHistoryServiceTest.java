package pl.bawar.jarvis.lab.history;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import pl.bawar.jarvis.brain.training.EvaluationMetrics;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class LabHistoryServiceTest {
    @TempDir Path root;

    @Test void snapshotsDoNotOverwritePreviouslySavedWeights() throws Exception {
        LabHistoryRepository repo = mock(LabHistoryRepository.class);
        LabHistoryService history = new LabHistoryService(repo);
        Path active = root.resolve("active.ckpt");
        Files.writeString(active, "checkpoint-one");
        history.checkpointSaved(active, null);
        Files.writeString(active, "checkpoint-two");
        history.checkpointSaved(active, null);
        List<Path> snapshots;
        try (var stream = Files.list(root.resolve("snapshots"))) { snapshots = stream.toList(); }
        assertEquals(2, snapshots.size());
        assertTrue(snapshots.stream().anyMatch(f -> {
            try { return Files.readString(f).equals("checkpoint-one"); }
            catch (Exception ex) { return false; }
        }));
        assertTrue(snapshots.stream().anyMatch(f -> {
            try { return Files.readString(f).equals("checkpoint-two"); }
            catch (Exception ex) { return false; }
        }));
        verify(repo, times(2)).checkpoint(any(), isNull(), eq("jarvis-tiny-v1"), anyString(), anyLong(), anyString());
    }

    @Test void corpusHashPreservesSampleBoundaries() {
        assertNotEquals(LabHistoryService.corpusDigest(List.of("ab", "c")),
                        LabHistoryService.corpusDigest(List.of("a", "bc")));
        assertEquals(LabHistoryService.corpusDigest(List.of("ala")),
                     LabHistoryService.corpusDigest(List.of("ala")));
    }

    @Test void recordsEvaluationMetricsNotRawText() {
        LabHistoryRepository repo = mock(LabHistoryRepository.class);
        LabHistoryService history = new LabHistoryService(repo);
        history.evaluated(new EvaluationMetrics(.5, Math.exp(.5), 3L), List.of("ala"));
        verify(repo).evaluation(any(UUID.class), isNull(), eq(.5), eq(Math.exp(.5)), eq(1), anyString());
    }

    @Test void rejectsNonFiniteLoss() {
        LabHistoryService history = new LabHistoryService(mock(LabHistoryRepository.class));
        assertThrows(IllegalArgumentException.class, () -> history.epoch(UUID.randomUUID().toString(), 1, 1, Double.NaN));
    }
}
