package pl.bawar.jarvis.research;

import java.text.Normalizer;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/** Bounded local lexical retrieval: no embeddings or additional programs. */
public final class KnowledgeRanker {
    private KnowledgeRanker() { }
    private static final Set<String> STOP = Set.of("jest", "oraz", "czy", "jak", "jaki", "jakie", "albo", "dla", "the", "and", "what", "with", "this", "that", "czyli", "mam", "moge", "chce", "about");
    static Set<String> tokens(String input) {
        String normalized = Normalizer.normalize(input.toLowerCase(Locale.ROOT), Normalizer.Form.NFKC);
        return Arrays.stream(normalized.split("[^\\p{L}\\p{N}]+"))
            .filter(s -> s.length() >= 3 && !STOP.contains(s))
            .limit(30).collect(Collectors.toSet());
    }
    public static int score(String query, String title, String excerpt) {
        Set<String> need = tokens(query);
        if (need.isEmpty()) return 0;
        Set<String> heading = tokens(title), body = tokens(excerpt);
        int result = 0;
        for (String word : need) {
            if (heading.contains(word)) result += 3;
            if (body.contains(word)) result += 1;
        }
        return result;
    }
}
