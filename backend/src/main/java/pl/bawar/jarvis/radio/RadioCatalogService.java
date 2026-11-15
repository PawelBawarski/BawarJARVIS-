package pl.bawar.jarvis.radio;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Fetches directory metadata only. Stream audio is NEVER proxied via Spring Boot. */
@Service
public class RadioCatalogService {
    private static final Set<String> COUNTRIES = Set.of("PL", "GB", "DE", "FR");
    private static final URI DIRECTORY = URI.create("https://de1.api.radio-browser.info");
    private final HttpClient client;
    private final ObjectMapper mapper;

    @Autowired
    public RadioCatalogService(ObjectMapper mapper) {
        this(mapper, HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5))
                .followRedirects(HttpClient.Redirect.NEVER).build());
    }

    RadioCatalogService(ObjectMapper mapper, HttpClient client) {
        this.mapper = mapper;
        this.client = client;
    }

    public record Station(String id, String name, String countryCode, String streamUrl) { }

    public List<Station> stations(String requestedCountry) {
        if (requestedCountry == null) throw new IllegalArgumentException("RADIO_COUNTRY_INVALID");
        String country = requestedCountry.toUpperCase(Locale.ROOT);
        if (!COUNTRIES.contains(country)) throw new IllegalArgumentException("RADIO_COUNTRY_INVALID");
        // No user-controlled URL or hostname reaches the HTTP client.
        URI uri = DIRECTORY.resolve("/json/stations/bycountrycodeexact/" + country
                + "?hidebroken=true&order=votes&reverse=true&limit=100");
        try {
            HttpRequest request = HttpRequest.newBuilder(uri).GET()
                    .header("User-Agent", "JARVIS-Radio/1.0")
                    .header("Accept", "application/json")
                    .timeout(Duration.ofSeconds(10)).build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200 || response.body().length() > 1_500_000) {
                throw new IllegalStateException("RADIO_DIRECTORY_UNAVAILABLE");
            }
            return parseStations(mapper.readTree(response.body()), country);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("RADIO_DIRECTORY_UNAVAILABLE", ex);
        } catch (Exception ex) {
            throw new IllegalStateException("RADIO_DIRECTORY_UNAVAILABLE", ex);
        }
    }

    static List<Station> parseStations(JsonNode root, String country) {
        List<Station> result = new ArrayList<>();
        if (!root.isArray()) return result;
        for (JsonNode value : root) {
            if (result.size() >= 40) break;
            String name = value.path("name").asText("").strip();
            String id = value.path("stationuuid").asText("");
            String stream = value.path("url_resolved").asText("");
            if (stream.isBlank()) stream = value.path("url").asText("");
            String codec = value.path("codec").asText("").toUpperCase(Locale.ROOT);
            if (name.isEmpty() || name.length() > 100 || id.length() > 80 || id.isBlank()
                    || !(codec.contains("MP3") || codec.contains("AAC")) || !safeStream(stream)) continue;
            result.add(new Station(id, name, country, stream));
        }
        return result;
    }

    static boolean safeStream(String stream) {
        try {
            URI uri = URI.create(stream);
            return "https".equalsIgnoreCase(uri.getScheme()) && uri.getHost() != null
                    && uri.getUserInfo() == null && uri.getPort() != 0
                    && !uri.getHost().equalsIgnoreCase("localhost")
                    && !uri.getHost().startsWith("127.")
                    && !uri.getHost().startsWith("192.168.")
                    && !uri.getHost().startsWith("10.");
        } catch (IllegalArgumentException ex) { return false; }
    }
}
