package pl.bawar.jarvis.observability;

import jakarta.servlet.RequestDispatcher;
import org.junit.jupiter.api.Test;
import org.springframework.boot.web.error.ErrorAttributeOptions;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.ServletWebRequest;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class JarvisErrorAttributesTest {

    private final JarvisErrorAttributes errors =
            new JarvisErrorAttributes();

    private Map<String, Object> attributes(
            int status,
            String requestId
    ) {
        var request = new MockHttpServletRequest(
                "GET", "/api/example"
        );

        request.setAttribute(
                RequestDispatcher.ERROR_STATUS_CODE,
                status
        );

        if (requestId != null) {
            request.setAttribute(
                    RequestIdFilter.MDC_KEY,
                    requestId
            );
        }

        return errors.getErrorAttributes(
                new ServletWebRequest(request),
                ErrorAttributeOptions.defaults()
        );
    }

    @Test
    void internalErrorIncludesRequestId() {
        var result = attributes(500, "test-request-123");

        assertEquals(500, result.get("status"));
        assertEquals(
                "INTERNAL_ERROR",
                result.get("code")
        );
        assertEquals(
                "test-request-123",
                result.get("requestId")
        );
    }

    @Test
    void internalErrorDoesNotExposeTechnicalDetails() {
        var result = attributes(500, "test-request-456");

        assertEquals(
                "Wystąpił wewnętrzny błąd aplikacji.",
                result.get("message")
        );

        assertFalse(result.containsKey("trace"));
        assertFalse(result.containsKey("exception"));
        assertFalse(result.containsKey("errors"));
    }

    @Test
    void badRequestRetainsItsHttpStatus() {
        var result = attributes(400, "test-request-789");

        assertEquals(400, result.get("status"));
        assertEquals(
                "test-request-789",
                result.get("requestId")
        );

        // Do not overwrite existing 4xx codes.
        assertFalse(result.containsKey("code"));
    }

    @Test
    void missingRequestIdDoesNotCreateFakeIdentifier() {
        var result = attributes(500, null);

        assertFalse(result.containsKey("requestId"));
        assertEquals("INTERNAL_ERROR", result.get("code"));
    }
}
