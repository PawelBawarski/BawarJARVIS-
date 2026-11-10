package pl.bawar.jarvis.research;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

/** Fixed HTTPS Wikimedia hosts only. Renderer never supplies a URL to fetch. */
@Component
public class WikipediaClient {
    private final HttpClient http;
    private final JsonMapper mapper;

    @Autowired
    public WikipediaClient(JsonMapper mapper) {
        this(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5))
            .followRedirects(HttpClient.Redirect.NEVER).build(), mapper);
    }
    WikipediaClient(HttpClient http, JsonMapper mapper) { this.http = http; this.mapper = mapper; }

    public record Hit(String title, String excerpt, String url, String language) { }
    public record Article(String title, String excerpt, String url) { }

    public List<Hit> search(String query, String language) {
        validateLanguage(language);
        if (query == null || query.isBlank() || query.length() > 120) throw new IllegalArgumentException("Invalid query");
        URI uri = URI.create("https://" + language + ".wikipedia.org/w/rest.php/v1/search/page?q="
                + enc(query.strip()) + "&limit=5");
        JsonNode json = request(uri);
        List<Hit> hits = new ArrayList<>();
        for (JsonNode page : json.path("pages")) {
            String title = page.path("title").asText("");
            if (title.isBlank() || title.length() > 200) continue;
            String excerpt = clean(page.path("excerpt").asText(""));
            hits.add(new Hit(title, excerpt, articleUrl(title, language), language));
        }
        return List.copyOf(hits);
    }

    public Article article(String title, String language) {
        validateLanguage(language);
        if (title == null || title.isBlank() || title.length() > 200
              || title.contains("/") || title.contains("\\")) throw new IllegalArgumentException("Invalid title");
        URI uri = URI.create("https://" + language + ".wikipedia.org/api/rest_v1/page/summary/" + enc(title.strip()));
        JsonNode json = request(uri);
        String fetchedTitle = clean(json.path("title").asText(""));
        String excerpt = clean(json.path("extract").asText(""));
        if (fetchedTitle.isBlank() || excerpt.isBlank()) throw new IllegalArgumentException("No article content");
        return new Article(fetchedTitle.substring(0, Math.min(fetchedTitle.length(), 250)),
            excerpt.substring(0, Math.min(excerpt.length(), 1500)), articleUrl(title, language));
    }

    private JsonNode request(URI uri) {
        try {
            HttpRequest req = HttpRequest.newBuilder(uri).GET().timeout(Duration.ofSeconds(12))
               .header("User-Agent", "JarvisDesktop/0.1 (educational local assistant)")
               .header("Accept", "application/json").build();
            HttpResponse<byte[]> res = http.send(req, HttpResponse.BodyHandlers.ofByteArray());
            if (res.statusCode() != 200 || res.body().length > 100_000)
                throw new IllegalStateException("Wikipedia unavailable (HTTP " + res.statusCode() + ")");
            return mapper.readTree(res.body());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Request interrupted", e);
        } catch (IOException e) { throw new IllegalStateException("Wikipedia connection error", e); }
    }

    public static void validateLanguage(String language) {
        if (!"pl".equals(language) && !"en".equals(language)) throw new IllegalArgumentException("Unsupported language");
    }
    private static String enc(String text) { return URLEncoder.encode(text, StandardCharsets.UTF_8).replace("+", "%20"); }
    private static String articleUrl(String title, String language) {
        return "https://" + language + ".wikipedia.org/wiki/" + enc(title.replace(' ', '_'));
    }
    static String clean(String source) {
        return source.replaceAll("(?s)<[^>]*>", " ").replace("&amp;", "&")
                .replace("&quot;", "\"").replace("&#39;", "'")
                .replaceAll("[\\p{Cntrl}&&[^\\n\\t]]", " ").replaceAll("\\s+", " ").trim();
    }
}
