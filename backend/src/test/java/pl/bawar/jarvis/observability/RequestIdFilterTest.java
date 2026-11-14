package pl.bawar.jarvis.observability;

import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class RequestIdFilterTest {

    private final RequestIdFilter filter = new RequestIdFilter();

    @Test
    void addsRequestIdAndMakesItAvailableInsideMdc() throws Exception {
        var request = new MockHttpServletRequest("GET", "/api/chats");
        var response = new MockHttpServletResponse();

        filter.doFilter(request, response, (req, res) -> {
            String requestId = response.getHeader(RequestIdFilter.HEADER);

            assertNotNull(requestId);
            assertEquals(requestId, MDC.get(RequestIdFilter.MDC_KEY));
            assertDoesNotThrow(() -> UUID.fromString(requestId));
        });

        assertNull(MDC.get(RequestIdFilter.MDC_KEY));
    }

    @Test
    void ignoresClientSuppliedRequestId() throws Exception {
        var request = new MockHttpServletRequest("GET", "/api/chats");
        request.addHeader(RequestIdFilter.HEADER, "untrusted-client-value");

        var response = new MockHttpServletResponse();

        filter.doFilter(request, response, (req, res) -> { });

        assertNotEquals(
                "untrusted-client-value",
                response.getHeader(RequestIdFilter.HEADER)
        );
    }

    @Test
    void restoresPreviousMdcValueAfterProcessing() throws Exception {
        var request = new MockHttpServletRequest("GET", "/api/chats");
        var response = new MockHttpServletResponse();

        MDC.put(RequestIdFilter.MDC_KEY, "previous-request");
        try {
            filter.doFilter(request, response, (req, res) -> {
                assertNotEquals(
                        "previous-request",
                        MDC.get(RequestIdFilter.MDC_KEY)
                );
            });

            assertEquals(
                    "previous-request",
                    MDC.get(RequestIdFilter.MDC_KEY)
            );
        } finally {
            MDC.remove(RequestIdFilter.MDC_KEY);
        }
    }

    @Test
    void clearsMdcEvenWhenHandlerThrows() {
        var request = new MockHttpServletRequest("GET", "/api/chats");
        var response = new MockHttpServletResponse();

        assertThrows(IllegalStateException.class, () ->
                filter.doFilter(request, response, (req, res) -> {
                    throw new IllegalStateException("Simulated failure");
                })
        );

        assertNull(MDC.get(RequestIdFilter.MDC_KEY));
    }
}
