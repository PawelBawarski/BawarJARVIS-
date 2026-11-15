package pl.bawar.jarvis.lab.lora;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class LoraTrainingControllerTest {
    @Test void inputBoundsDoNotAllowUnboundedGpuJobs() {
        assertThrows(IllegalArgumentException.class, () -> LoraTrainingService.validate(0,128));
        assertThrows(IllegalArgumentException.class, () -> LoraTrainingService.validate(201,128));
        assertThrows(IllegalArgumentException.class, () -> LoraTrainingService.validate(6,513));
        assertDoesNotThrow(() -> LoraTrainingService.validate(6,128));
    }
    @Test void controllerDoesNotStartWithoutParameters() {
        var service=mock(LoraTrainingService.class);
        var controller=new LoraTrainingController(service);
        assertThrows(IllegalArgumentException.class, () -> controller.start(null));
        assertThrows(IllegalArgumentException.class, () -> controller.start(new LoraTrainingController.StartRequest(null,128)));
        verifyNoInteractions(service);
    }
    @Test void controllerPassesFixedParametersToLocalService() {
        var service=mock(LoraTrainingService.class);
        var controller=new LoraTrainingController(service);
        controller.start(new LoraTrainingController.StartRequest(6,128));
        verify(service).start(6,128);
    }
}
