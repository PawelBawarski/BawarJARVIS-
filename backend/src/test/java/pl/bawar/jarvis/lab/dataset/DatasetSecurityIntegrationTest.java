package pl.bawar.jarvis.lab.dataset;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
    "JARVIS_SESSION_TOKEN=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "jarvis.ai-lab.legacy-enabled=true"
})
@AutoConfigureMockMvc
class DatasetSecurityIntegrationTest {

    private static final String TOKEN =
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    private static final String URL = "/api/ai-lab/datasets";

    @Autowired
    MockMvc mvc;

    @Autowired
    org.springframework.jdbc.core.JdbcTemplate jdbc;

    private static String validJson(String name) {
        return """
            {
              "name": "%s",
              "examples": ["alpha", "beta", "gamma", "delta", "epsilon"]
            }
            """.formatted(name);
    }

    @Test
    void unauthenticatedDatasetReadReturns401() throws Exception {
        mvc.perform(get(URL))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void unauthenticatedDatasetCreationReturns401() throws Exception {
        mvc.perform(post(URL)
                .contentType(MediaType.APPLICATION_JSON)
                .content(validJson("Unauthenticated")))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void incorrectSessionTokenReturns401() throws Exception {
        mvc.perform(get(URL)
                .header("X-Jarvis-Session",
                    "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void validSessionCanCreateAndReadDataset() throws Exception {
        mvc.perform(post(URL)
                .header("X-Jarvis-Session", TOKEN)
                .contentType(MediaType.APPLICATION_JSON)
                .content(validJson("Security " + UUID.randomUUID())))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.versionNumber").value(1))
            .andExpect(jsonPath("$.datasetId").isNotEmpty())
            .andExpect(jsonPath("$.id").isNotEmpty());

        mvc.perform(get(URL)
                .header("X-Jarvis-Session", TOKEN))
            .andExpect(status().isOk());
    }

    @Test
    void validSessionWithInvalidDatasetReturns400() throws Exception {
        mvc.perform(post(URL)
                .header("X-Jarvis-Session", TOKEN)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "name": "Invalid",
                      "examples": ["only-one"]
                    }
                    """))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("BAD_REQUEST"))
            .andExpect(jsonPath("$.message").doesNotExist());
    }

    @Test
    void malformedJsonReturns400WithoutInternalDetails() throws Exception {
        mvc.perform(post(URL)
                .header("X-Jarvis-Session", TOKEN)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{invalid-json"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("BAD_REQUEST"))
            .andExpect(jsonPath("$.message").doesNotExist());
    }


    @Test
    void existingDatasetWithoutVersionsReturns200() throws Exception {
        UUID id = UUID.randomUUID();

        jdbc.update(
            "INSERT INTO jarvis_datasets(id, name, created_at) " +
            "VALUES (?, ?, CURRENT_TIMESTAMP)",
            id,
            "Empty dataset for HTTP test"
        );

        mvc.perform(get(URL + "/" + id + "/versions")
                .header("X-Jarvis-Session", TOKEN))
            .andExpect(status().isOk())
            .andExpect(content().json("[]"));
    }

    @Test
    void unknownDatasetReturns404() throws Exception {
        UUID unknown = UUID.randomUUID();

        mvc.perform(get(URL + "/" + unknown + "/versions")
                .header("X-Jarvis-Session", TOKEN))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void unknownVersionReturns404() throws Exception {
        UUID unknown = UUID.randomUUID();

        mvc.perform(get(URL + "/versions/" + unknown)
                .header("X-Jarvis-Session", TOKEN))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }
}
