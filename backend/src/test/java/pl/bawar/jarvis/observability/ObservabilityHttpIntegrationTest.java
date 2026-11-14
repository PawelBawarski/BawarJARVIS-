package pl.bawar.jarvis.observability;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;

import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.UUID;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(
    classes = ObservabilityHttpIntegrationTest.TestApplication.class,
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
        "spring.flyway.enabled=false",
        "spring.datasource.url=jdbc:h2:mem:m03_observability;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "logging.level.pl.bawar.jarvis.observability=INFO",
        "logging.pattern.level=%5p [requestId=%X{requestId:-none}]"
    }
)
@ExtendWith(OutputCaptureExtension.class)
class ObservabilityHttpIntegrationTest {

    @Value("${local.server.port}")
    private int port;

    private HttpResponse<String> request(String path) throws Exception {
        var httpRequest = HttpRequest.newBuilder()
            .uri(URI.create("http://127.0.0.1:" + port + path))
            .GET()
            .build();

        try (var client = HttpClient.newHttpClient()) {
            return client.send(
                httpRequest,
                HttpResponse.BodyHandlers.ofString()
            );
        }
    }

    @Test
    void realHttp500IncludesRequestIdAndHidesExceptionDetails()
            throws Exception {

        var response = request("/m03-test/boom");

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR.value(),
                response.statusCode());

        String requestId = response.headers()
                .firstValue(RequestIdFilter.HEADER)
                .orElseThrow();

        assertDoesNotThrow(() -> UUID.fromString(requestId));

        String body = response.body();

        assertTrue(body.contains("INTERNAL_ERROR"));
        assertTrue(body.contains(requestId));
        assertFalse(body.contains("M03_PRIVATE_EXCEPTION_SENTINEL"));
        assertFalse(body.contains("java.lang.IllegalStateException"));
        assertFalse(body.contains("stackTrace"));
    }

    @Test
    void actualConsoleLogContainsSameRequestId(
            CapturedOutput output
    ) throws Exception {

        var response = request("/m03-test/log");

        assertEquals(200, response.statusCode());

        String requestId = response.headers()
                .firstValue(RequestIdFilter.HEADER)
                .orElseThrow();

        String logs = output.getAll();

        assertTrue(
            logs.contains("M03_SAFE_LOG_MARKER"),
            "Nie znaleziono kontrolnego wpisu SLF4J."
        );

        assertTrue(
            Pattern.compile(
                "requestId\\s*=\\s*" + Pattern.quote(requestId)
            ).matcher(logs).find(),
            "Rzeczywisty log nie zawiera requestId. "
                + "Sprawdź konfigurację Logback."
        );
    }

    @Configuration(proxyBeanMethods = false)
    @EnableAutoConfiguration(exclude = {
        org.springframework.boot.security.autoconfigure
                .UserDetailsServiceAutoConfiguration.class
    })
    @Import({
        RequestIdFilter.class,
        JarvisErrorAttributes.class,
        TestController.class,
        TestSecurity.class
    })
    static class TestApplication {
    }

    @RestController
    static class TestController {

        private static final Logger log =
                LoggerFactory.getLogger(TestController.class);

        @GetMapping("/m03-test/boom")
        public String boom() {
            throw new IllegalStateException(
                "M03_PRIVATE_EXCEPTION_SENTINEL"
            );
        }

        @GetMapping("/m03-test/log")
        public String logRequest() {
            log.info("M03_SAFE_LOG_MARKER");
            return "ok";
        }
    }

    @Configuration(proxyBeanMethods = false)
    static class TestSecurity {

        @Bean
        SecurityFilterChain testSecurity(HttpSecurity http)
                throws Exception {

            http.authorizeHttpRequests(
                auth -> auth.anyRequest().permitAll()
            );

            return http.build();
        }
    }
}
