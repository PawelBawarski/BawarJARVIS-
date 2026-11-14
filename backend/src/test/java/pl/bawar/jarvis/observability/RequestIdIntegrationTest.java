package pl.bawar.jarvis.observability;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class RequestIdIntegrationTest {

    @Autowired
    private MockMvc mvc;

    private static UUID parseRequestId(String header) {
        assertNotNull(header, "Missing X-Request-Id");
        return UUID.fromString(header);
    }

    @Test
    void publicHealthEndpointReturnsRequestId() throws Exception {
        var result = mvc.perform(
                get("/api/security/health")
        )
        .andExpect(status().isOk())
        .andReturn();

        parseRequestId(
                result.getResponse().getHeader(RequestIdFilter.HEADER)
        );
    }

    @Test
    void unauthorizedRequestAlsoReturnsRequestId() throws Exception {
        var result = mvc.perform(
                get("/api/security/private-health")
        )
        .andExpect(status().isUnauthorized())
        .andReturn();

        parseRequestId(
                result.getResponse().getHeader(RequestIdFilter.HEADER)
        );
    }

    @Test
    void incomingRequestIdCannotOverrideServerGeneratedId()
            throws Exception {

        String maliciousId = "forged-client-request-id";

        var result = mvc.perform(
                get("/api/security/health")
                    .header(RequestIdFilter.HEADER, maliciousId)
        )
        .andExpect(status().isOk())
        .andReturn();

        String actualId = result.getResponse()
                .getHeader(RequestIdFilter.HEADER);

        assertNotEquals(maliciousId, actualId);
        parseRequestId(actualId);
    }

    @Test
    void consecutiveRequestsHaveDifferentIds() throws Exception {
        var first = mvc.perform(
                get("/api/security/health")
        )
        .andExpect(status().isOk())
        .andReturn();

        var second = mvc.perform(
                get("/api/security/health")
        )
        .andExpect(status().isOk())
        .andReturn();

        UUID firstId = parseRequestId(
                first.getResponse().getHeader(RequestIdFilter.HEADER)
        );

        UUID secondId = parseRequestId(
                second.getResponse().getHeader(RequestIdFilter.HEADER)
        );

        assertNotEquals(firstId, secondId);
    }

    @Test
    void unauthorizedResponseDoesNotExposeCredentials()
            throws Exception {

        String secret = "jarvis-test-secret-do-not-log";

        var result = mvc.perform(
                get("/api/security/private-health")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + secret)
                    .header("X-Jarvis-Session", secret)
        )
        .andExpect(status().isUnauthorized())
        .andReturn();

        String body = result.getResponse().getContentAsString();

        assertFalse(body.contains(secret));
        parseRequestId(
                result.getResponse().getHeader(RequestIdFilter.HEADER)
        );
    }
}
