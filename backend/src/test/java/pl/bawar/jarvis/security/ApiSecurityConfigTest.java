
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

    @Autowired
    private org.springframework.context.ApplicationContext context;

    @Test
    void doesNotCreateDefaultSpringSecurityUser() {
        var services = context.getBeansOfType(
            org.springframework.security.core.userdetails.UserDetailsService.class
        );

        org.junit.jupiter.api.Assertions.assertTrue(
            services.isEmpty(),
            "J.A.R.V.I.S. must not create a default password-based user"
        );
    }


    @Test
    void shouldAllowBackendHealthCheck() throws Exception {
        mockMvc.perform(
                get("/api/security/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    void shouldRequireAuthenticationForUnknownApiEndpoint()
            throws Exception {

        mockMvc.perform(
                get("/api/internal/example"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void shouldDenyUnauthenticatedPost() throws Exception {
        mockMvc.perform(
                post("/api/articles"))
                .andExpect(status().isForbidden());
    }
}
