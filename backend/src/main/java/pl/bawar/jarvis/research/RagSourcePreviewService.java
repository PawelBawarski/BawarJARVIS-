package pl.bawar.jarvis.research;

import java.net.URI;
import java.util.List;
import java.util.Objects;
import org.springframework.stereotype.Service;

/** Read-only view of current retrieval candidates. NOT citations of a model's actual answer. */
@Service
public class RagSourcePreviewService {
    private static final int MAX_QUERY = 500;
    private static final int MAX_SOURCES = 5;
    private static final int MAX_EXCERPT = 360;

    private final SemanticMemoryService semantic;
    private final KnowledgeMemoryService memory;

    public RagSourcePreviewService(SemanticMemoryService semantic, KnowledgeMemoryService memory) {
        this.semantic = Objects.requireNonNull(semantic);
        this.memory = Objects.requireNonNull(memory);
    }

    public record Source(String id, String title, String excerpt, String method, String externalUrl,
                         boolean local) { }
    public record Preview(String query, List<Source> sources, boolean snapshotOfAnswer) { }

    /** Does not write to PostgreSQL and never sends a request to the chat model. */
    public Preview preview(String rawQuestion) {
        if (rawQuestion == null) throw new IllegalArgumentException("RAG_SOURCE_QUERY_INVALID");
        String question = rawQuestion.strip();
        if (question.isEmpty() || question.length() > MAX_QUERY || question.indexOf('\0') >= 0)
            throw new IllegalArgumentException("RAG_SOURCE_QUERY_INVALID");

        // Same hybrid retrieval used by Chat when semantic memory is enabled.
        List<Source> sources = semantic.find(question, memory).stream().limit(MAX_SOURCES)
            .map(hit -> new Source(
                hit.id().toString(),
                limitText(hit.title(), 160),
                limitText(hit.excerpt(), MAX_EXCERPT),
                "semantic".equals(hit.method()) ? "semantic" : "text",
                externalHttpUrl(hit.url()),
                externalHttpUrl(hit.url()) == null
            )).toList();
        // A fresh lookup can differ from the retrieved sources used earlier to create an answer.
        return new Preview(question, sources, false);
    }

    private static String limitText(String value, int limit) {
        if (value == null) return "";
        String safe = value.replace('\0', ' ').strip();
        return safe.length() <= limit ? safe : safe.substring(0, limit);
    }

    static String externalHttpUrl(String raw) {
        if (raw == null || raw.isBlank() || raw.length() > 1024) return null;
        try {
            URI uri = URI.create(raw);
            if (("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme()))
                    && uri.getHost() != null && uri.getUserInfo() == null) return uri.toASCIIString();
        } catch (IllegalArgumentException ignored) { /* Local knowledge uses non-HTTP source identifiers. */ }
        return null;
    }
}
