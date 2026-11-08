
package pl.bawar.jarvis.security;

import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;

import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class ApiSecurityConfigTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void shouldAllowBackendHealthCheck() throws Exception {
        mockMvc.perform(
                get("/api/security/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    void shouldDenyUnknownApiEndpoint() throws Exception {
        mockMvc.perform(
                get("/api/internal/example"))
                .andExpect(status().isForbidden());
    }

    @Test
    void shouldDenyUnauthenticatedPost() throws Exception {
        mockMvc.perform(
                post("/api/articles"))
                .andExpect(status().isForbidden());
    }
}
