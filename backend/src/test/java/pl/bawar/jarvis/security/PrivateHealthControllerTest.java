package pl.bawar.jarvis.security;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "JARVIS_SESSION_TOKEN=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
})
@AutoConfigureMockMvc
class PrivateHealthControllerTest {

    @Autowired
    MockMvc mvc;

    @Test
    void shouldReturn401WithoutToken() throws Exception {
        mvc.perform(get("/api/security/private-health"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void shouldReturn401WithWrongToken() throws Exception {
        mvc.perform(get("/api/security/private-health")
                        .header("X-Jarvis-Session",
                                "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void shouldAllowValidToken() throws Exception {
        mvc.perform(get("/api/security/private-health")
                        .header("X-Jarvis-Session",
                                "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("AUTHENTICATED"));
    }

    @Test
    void shouldStillDenyUnlistedEndpoint() throws Exception {
        mvc.perform(get("/api/internal/secret")
                        .header("X-Jarvis-Session",
                                "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"))
                .andExpect(status().isForbidden());
    }
}
