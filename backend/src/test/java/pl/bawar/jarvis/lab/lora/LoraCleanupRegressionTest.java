package pl.bawar.jarvis.lab.lora;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.http.HttpStatus;
import tools.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class LoraCleanupRegressionTest {
    @Test void exportedDatasetDtoNeverExposesLocalFilePath() {
        var dataset = new LoraEvidenceService.Dataset("reviewed-"+UUID.randomUUID(), 2);
        var json = new ObjectMapper().writeValueAsString(dataset);
        assertFalse(json.contains("path"));
        assertFalse(json.contains("C:\\"));
        assertTrue(json.contains("examples"));
    }

    @Test void olderReviewedEvidenceIsReadByUuidNotFromLimitedList() {
        var jdbc = mock(JdbcTemplate.class);
        var pref = mock(pl.bawar.jarvis.chat.api.InternetPreferenceRepository.class);
        String id = UUID.randomUUID().toString();
        when(jdbc.update(anyString(), any(), any(), any(), any())).thenReturn(1);
        var expected = new LoraEvidenceService.Evidence(id,"query","title","https://example.com", "snippet","Q","A",true);
        when(jdbc.query(anyString(), any(RowMapper.class), eq(id))).thenReturn(List.of(expected));
        var service = new LoraEvidenceService(jdbc,pref,new ObjectMapper(),"", "http://127.0.0.1:8888");
        var result = service.review(id,new LoraEvidenceService.Review("Q","A",true));
        assertEquals(expected,result);
        verify(jdbc).query(contains("WHERE id=?::uuid"),any(RowMapper.class),eq(id));
        verify(jdbc,never()).query(contains("LIMIT 150"),any(RowMapper.class));
    }

    @Test void disabledStatusIsReadableWithoutStartingPython() {
        var service = new LoraTrainingService(mock(JdbcTemplate.class),new ObjectMapper(),"",false);
        assertEquals("disabled",service.status().status());
        assertFalse(service.status().processAlive());
        assertEquals("LORA_TRAINING_DISABLED", assertThrows(IllegalStateException.class, () -> service.start(6,128)).getMessage());
    }

    @Test void disabledTrainingReturnsConflictNotServerError() {
        var response = new LoraApiErrorHandler().state(new IllegalStateException("LORA_TRAINING_DISABLED"));
        assertEquals(HttpStatus.CONFLICT,response.getStatusCode());
        assertEquals("LORA_TRAINING_DISABLED",response.getBody().get("code"));
    }
}
