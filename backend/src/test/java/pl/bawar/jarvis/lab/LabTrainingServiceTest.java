package pl.bawar.jarvis.lab;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import pl.bawar.jarvis.runtime.JarvisModelService;
import pl.bawar.jarvis.runtime.TrainingSummary;
import java.io.IOException;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class LabTrainingServiceTest {
    private final JarvisModelService model = Mockito.mock(JarvisModelService.class);
    private final LabTrainingService service = new LabTrainingService(model);

    @AfterEach void shutdown() { service.shutdown(); }

    @Test void rejectsOversizedAndInvalidJobs() {
        assertThrows(IllegalArgumentException.class, () -> service.start(List.of(), 1));
        assertThrows(IllegalArgumentException.class, () -> service.start(List.of("abc"), 101));
        assertThrows(IllegalArgumentException.class, () -> service.start(List.of(" "), 1));
        verifyNoInteractions(model);
    }

    @Test void runsEpochsAndExposesRealLosses() throws Exception {
        when(model.train(List.of("abc"), 1)).thenReturn(new TrainingSummary(1, 1, 0.9));
        var started = service.start(List.of("abc"), 3);
        assertEquals("RUNNING", started.status());
        LabTrainingService.TrainingState result = waitForDone();
        assertEquals("COMPLETED", result.status());
        assertEquals(3, result.epoch());
        assertEquals(List.of(0.9, 0.9, 0.9), result.losses());
        verify(model, times(3)).train(List.of("abc"), 1);
    }

    @Test void cannotStartTwiceOrSaveWhileRunning() throws Exception {
        var gate = new CountDownLatch(1);
        when(model.train(anyList(), eq(1))).thenAnswer(inv -> {
            if (!gate.await(3, TimeUnit.SECONDS)) throw new IllegalStateException("timeout");
            return new TrainingSummary(1, 1, 0.3);
        });
        service.start(List.of("abc"), 1);
        try {
            assertThrows(IllegalStateException.class, () -> service.start(List.of("abc"), 1));
            assertThrows(IllegalStateException.class, service::save);
            assertThrows(IllegalStateException.class, service::load);
        } finally { gate.countDown(); }
        assertEquals("COMPLETED", waitForDone().status());
    }

    @Test void neverAutoSavesCheckpoint() throws Exception {
        when(model.train(anyList(), eq(1))).thenReturn(new TrainingSummary(1, 1, 0.3));
        service.start(List.of("abc"), 1);
        assertEquals("COMPLETED", waitForDone().status());
        verify(model, never()).saveCheckpoint();
        verify(model, never()).loadCheckpoint();
    }

    private LabTrainingService.TrainingState waitForDone() throws InterruptedException {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        while (System.nanoTime() < deadline) {
            var value = service.progress();
            if (!value.status().equals("RUNNING")) return value;
            Thread.sleep(10);
        }
        fail("Training job did not finish within 5 seconds");
        return null;
    }
}
