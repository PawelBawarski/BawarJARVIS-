package pl.bawar.jarvis.observability;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.Properties;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class RequestIdLoggingTest {

    private static final Logger LOGGER =
            (Logger) LoggerFactory.getLogger(RequestIdLoggingTest.class);

    @Test
    void loggingPatternIncludesRequestIdWithoutSensitiveHeaders()
            throws Exception {

        Properties properties = new Properties();

        try (var stream = java.nio.file.Files.newInputStream(
                java.nio.file.Path.of(
                    "src/main/resources/application.properties"
                ))) {

            assertNotNull(stream);
            properties.load(stream);
        }

        String pattern = properties.getProperty("logging.pattern.level");

        assertNotNull(pattern);
        assertTrue(pattern.contains("%X{requestId"));
        assertFalse(pattern.contains("X-Jarvis-Session"));
        assertFalse(pattern.contains("Authorization"));
    }

    @Test
    void logEventReceivesRequestIdButNotClientSuppliedId()
            throws Exception {

        var appender = new ListAppender<ILoggingEvent>();
        appender.start();
        LOGGER.addAppender(appender);

        try {
            var request = new MockHttpServletRequest(
                    "GET", "/api/chats"
            );

            request.addHeader(
                    RequestIdFilter.HEADER,
                    "untrusted-client-id"
            );

            var response = new MockHttpServletResponse();

            new RequestIdFilter().doFilter(
                    request,
                    response,
                    (req, res) -> LOGGER.info(
                            "HTTP request reached backend"
                    )
            );

            assertEquals(1, appender.list.size());

            var event = appender.list.get(0);
            var requestId = response.getHeader(
                    RequestIdFilter.HEADER
            );

            assertNotNull(requestId);
            assertDoesNotThrow(() -> UUID.fromString(requestId));

            assertEquals(
                    requestId,
                    event.getMDCPropertyMap().get("requestId")
            );

            assertEquals(Level.INFO, event.getLevel());

            assertNotEquals(
                    "untrusted-client-id",
                    requestId
            );

            assertNull(MDC.get("requestId"));

        } finally {
            LOGGER.detachAppender(appender);
            appender.stop();
        }
    }
}
