package pl.bawar.jarvis.lab.lora;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import pl.bawar.jarvis.chat.api.InternetPreferenceRepository;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** Sources are proposals, never ground truth; human review is mandatory before LoRA. */
@Service
public class LoraEvidenceService {
    private final JdbcTemplate jdbc;
    private final InternetPreferenceRepository preference;
    private final ObjectMapper mapper;
    private final Path root;
    private final URI searx;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(4)).build();
    public LoraEvidenceService(JdbcTemplate jdbc, InternetPreferenceRepository preference, ObjectMapper mapper,
        @Value("${JARVIS_LORA_ROOT:}") String configuredRoot,
        @Value("${JARVIS_SEARXNG_URL:http://127.0.0.1:8888}") String searxUrl) {
        this.jdbc=jdbc; this.preference=preference; this.mapper=mapper;
        Path cwd=Path.of(System.getProperty("user.dir")).toAbsolutePath().normalize();
        this.root = configuredRoot == null || configuredRoot.isBlank()
            ? (cwd.getFileName()!=null && "backend".equals(cwd.getFileName().toString()) ? cwd.getParent() : cwd)
            : Path.of(configuredRoot).toAbsolutePath().normalize();
        this.searx=URI.create(searxUrl);
        // Do not permit SSRF through deployment variables. SearXNG must be local.
        if (!"http".equals(searx.getScheme()) || !List.of("localhost","127.0.0.1").contains(searx.getHost())
                || searx.getUserInfo()!=null || searx.getPort()<1) throw new IllegalArgumentException("SEARXNG_MUST_BE_LOOPBACK");
    }
    public record Evidence(String id,String query,String title,String url,String excerpt,String instruction,String response,boolean approved) {}
    public record Review(String instruction,String response,boolean approved) {}
    public record Dataset(String id,int examples,String path) {}

    public static void validateReview(Review review) {
        if(review==null || review.instruction()==null || review.response()==null
            || review.instruction().isBlank() || review.response().isBlank()
            || review.instruction().length()>800 || review.response().length()>1200)
            throw new IllegalArgumentException("Pytanie i odpowiedź są obowiązkowe (800/1200 znaków)");
    }
    public List<Evidence> search(String query) {
        if(!preference.enabled()) throw new IllegalStateException("INTERNET_ACCESS_DISABLED_IN_SETTINGS");
        if(query==null || query.isBlank() || query.length()>180) throw new IllegalArgumentException("SEARCH_QUERY_1_TO_180");
        String url=searx.toString().replaceAll("/$", "")+"/search?format=json&language=pl&q="+
            URLEncoder.encode(query.strip(), StandardCharsets.UTF_8);
        try {
            HttpRequest request=HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(12))
                    .header("Accept","application/json").GET().build();
            HttpResponse<String> response=http.send(request,HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if(response.statusCode()!=200) throw new IllegalStateException("SEARXNG_HTTP_"+response.statusCode());
            JsonNode results=mapper.readTree(response.body()).path("results");
            int count=0;
            if(results.isArray()) for(JsonNode entry:results) {
                if(count>=10) break;
                String source=entry.path("url").asText("");
                if(!safeSource(source)) continue;
                String title=truncate(entry.path("title").asText(""),400);
                String excerpt=truncate(entry.path("content").asText(""),1800);
                if(title.isBlank() || excerpt.isBlank()) continue;
                jdbc.update("""
                    INSERT INTO lora_web_evidence(id,query_text,title,source_url,excerpt)
                    VALUES (?::uuid,?,?,?,?) ON CONFLICT (source_url) DO NOTHING
                    """, UUID.randomUUID().toString(),query.strip(),title,source,excerpt);
                count++;
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt(); throw new IllegalStateException("SEARXNG_INTERRUPTED",e);
        } catch (java.io.IOException e) { throw new IllegalStateException("SEARXNG_UNAVAILABLE",e); }
        return list();
    }
    static boolean safeSource(String source) {
        try {
            URI uri=URI.create(source);
            if(!List.of("http","https").contains(uri.getScheme()) || uri.getUserInfo()!=null) return false;
            String host=uri.getHost();
            if(host==null || host.equalsIgnoreCase("localhost") || host.endsWith(".local")) return false;
            if(host.matches("(?i)(127\\..*|10\\..*|192\\.168\\..*|169\\.254\\..*|0\\..*|172\\.(1[6-9]|2[0-9]|3[01])\\..*)")) return false;
            return source.length()<=1200;
        } catch (IllegalArgumentException e) { return false; }
    }
    private static String truncate(String v,int limit){return v.length()>limit?v.substring(0,limit):v;}
    public List<Evidence> list() {
        return jdbc.query("""
          SELECT id::text,query_text,title,source_url,excerpt,instruction,response,approved
          FROM lora_web_evidence ORDER BY created_at DESC LIMIT 150
        """, (rs,n)->new Evidence(rs.getString(1),rs.getString(2),rs.getString(3),rs.getString(4),
             rs.getString(5),rs.getString(6),rs.getString(7),rs.getBoolean(8)));
    }
    public Evidence review(String id,Review item) {
        validateReview(item);
        UUID uuid=UUID.fromString(id);
        int changed=jdbc.update("""
          UPDATE lora_web_evidence SET instruction=?, response=?, approved=?, reviewed_at=now()
          WHERE id=?::uuid
        """,item.instruction().strip(),item.response().strip(),item.approved(),uuid.toString());
        if(changed!=1) throw new IllegalArgumentException("EVIDENCE_NOT_FOUND");
        return list().stream().filter(x->x.id().equals(id)).findFirst().orElseThrow();
    }
    /** Stable export: only approved, manually written Q/A; source metadata is not trained as an answer. */
    public synchronized Dataset export() {
        var rows=jdbc.query("""
             SELECT instruction,response,source_url FROM lora_web_evidence
             WHERE approved=true AND instruction IS NOT NULL AND response IS NOT NULL
             ORDER BY reviewed_at DESC LIMIT 500
        """,(rs,n)->new String[]{rs.getString(1),rs.getString(2),rs.getString(3)});
        if(rows.size()<2) throw new IllegalStateException("REQUIRES_TWO_APPROVED_EXAMPLES");
        String id="reviewed-"+UUID.randomUUID();
        Path folder=root.resolve("training/data").normalize();
        Path file=folder.resolve(id+".jsonl");
        try {
            Files.createDirectories(folder);
            Path tmp=folder.resolve(id+".tmp");
            var out=new ArrayList<String>();
            for(var row:rows) out.add(mapper.writeValueAsString(java.util.Map.of(
                "instruction",row[0],"response",row[1],"source",row[2])));
            Files.writeString(tmp,String.join("\n",out)+"\n",StandardCharsets.UTF_8);
            Files.move(tmp,file,StandardCopyOption.ATOMIC_MOVE);
        } catch (java.io.IOException e) { throw new IllegalStateException("DATASET_EXPORT_FAILED",e); }
        return new Dataset(id,rows.size(),file.toString());
    }
}
