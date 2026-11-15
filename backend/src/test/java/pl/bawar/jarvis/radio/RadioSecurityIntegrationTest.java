package pl.bawar.jarvis.radio;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "JARVIS_SESSION_TOKEN=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
@AutoConfigureMockMvc
class RadioSecurityIntegrationTest {
    private static final String TOKEN = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    @Autowired private MockMvc mockMvc;

    @Test
    void radioRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/radio/stations").param("country", "ZZ"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void radioAcceptsValidLocalSessionAndRejectsBadCountry() throws Exception {
        // Invalid country is handled before calling the external radio directory.
        mockMvc.perform(get("/api/radio/stations").param("country", "ZZ")
                .header("X-Jarvis-Session", TOKEN))
            .andExpect(status().isBadRequest());
    }
}
