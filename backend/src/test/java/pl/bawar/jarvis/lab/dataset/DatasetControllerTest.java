package pl.bawar.jarvis.lab.dataset;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class DatasetControllerTest {

    private DatasetService service;
    private MockMvc mvc;

    @BeforeEach
    void setup() {
        service = mock(DatasetService.class);

        mvc = MockMvcBuilders
            .standaloneSetup(new DatasetController(service))
            .setControllerAdvice(new DatasetErrorHandler())
            .build();
    }

    @Test
    void createsDatasetWith201() throws Exception {
        var created = new DatasetRepository.Version(
            UUID.randomUUID().toString(),
            UUID.randomUUID().toString(),
            1,
            "2026-01-01T00:00:00Z",
            4,
            1,
            "a".repeat(64),
            "b".repeat(64)
        );

        when(service.create(eq("Demo"), anyList()))
            .thenReturn(created);

        mvc.perform(post("/api/ai-lab/datasets")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "name": "Demo",
                      "examples": ["a", "b", "c", "d", "e"]
                    }
                    """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.versionNumber").value(1))
            .andExpect(jsonPath("$.datasetId").value(created.datasetId()));
    }

    @Test
    void invalidDatasetReturns400WithoutInternalDetails() throws Exception {
        when(service.create(eq("Bad"), anyList()))
            .thenThrow(new IllegalArgumentException("Private validation details"));

        mvc.perform(post("/api/ai-lab/datasets")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"name":"Bad","examples":["a"]}
                    """))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("BAD_REQUEST"))
            .andExpect(jsonPath("$.message").doesNotExist());
    }

    @Test
    void malformedJsonReturns400() throws Exception {
        mvc.perform(post("/api/ai-lab/datasets")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{invalid json"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("BAD_REQUEST"));

        verifyNoInteractions(service);
    }

    @Test
    void unknownDatasetReturns404() throws Exception {
        UUID datasetId = UUID.randomUUID();

        when(service.versions(datasetId))
            .thenThrow(new IllegalArgumentException("Unknown dataset"));

        mvc.perform(get("/api/ai-lab/datasets/" + datasetId + "/versions"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void unknownVersionReturns404() throws Exception {
        UUID versionId = UUID.randomUUID();

        when(service.readVersion(versionId))
            .thenThrow(new IllegalArgumentException("Unknown dataset version"));

        mvc.perform(get("/api/ai-lab/datasets/versions/" + versionId))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void revisingUnknownDatasetReturns404() throws Exception {
        UUID datasetId = UUID.randomUUID();

        when(service.newVersion(eq(datasetId), anyList()))
            .thenThrow(new IllegalArgumentException("Unknown dataset"));

        mvc.perform(post("/api/ai-lab/datasets/" + datasetId + "/versions")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"examples":["a","b","c","d","e"]}
                    """))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void controllerRequiresJarvisAuthority() {
        PreAuthorize annotation =
            DatasetController.class.getAnnotation(PreAuthorize.class);

        assertNotNull(annotation);
        assertEquals(
            "hasAuthority('ROLE_JARVIS')",
            annotation.value()
        );
    }
}
