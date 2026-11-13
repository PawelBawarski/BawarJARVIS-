package pl.bawar.jarvis.research;

import java.util.ArrayList;
import java.util.List;

/** Pure text splitter. Nothing from a document is interpreted as an instruction. */
final class DocumentTextChunks {
    static final int CHUNK_SIZE = 1_100;
    static final int OVERLAP = 120;
    static final int MAX_CHUNKS = 200;
    static final int MAX_TEXT_CHARS = 150_000;

    private DocumentTextChunks() { }

    static List<String> split(String source) {
        if (source == null) throw new IllegalArgumentException("MEMORY_DOC_TEXT_EMPTY");
        String text = source.replace("\r\n", "\n").replace('\r', '\n').strip();
        if (text.isBlank()) throw new IllegalArgumentException("MEMORY_DOC_TEXT_EMPTY");
        if (text.length() > MAX_TEXT_CHARS || text.indexOf('\u0000') >= 0)
            throw new IllegalArgumentException("MEMORY_DOC_TEXT_TOO_LARGE");
        List<String> chunks = new ArrayList<>();
        int start = 0;
        while (start < text.length()) {
            int end = Math.min(start + CHUNK_SIZE, text.length());
            if (end < text.length()) {
                // Prefer natural paragraph and sentence boundaries, but keep forward progress.
                int paragraph = text.lastIndexOf("\n\n", end);
                if (paragraph > start + CHUNK_SIZE / 2) end = paragraph + 2;
                else {
                    int space = text.lastIndexOf(' ', end);
                    if (space > start + CHUNK_SIZE * 3 / 4) end = space + 1;
                }
            }
            chunks.add(text.substring(start, end).strip());
            if (chunks.size() > MAX_CHUNKS) throw new IllegalArgumentException("MEMORY_DOC_TOO_MANY_CHUNKS");
            if (end == text.length()) break;
            start = Math.max(start + 1, end - OVERLAP);
        }
        return List.copyOf(chunks);
    }
}
