package pl.bawar.jarvis.research;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.PreparedStatement;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.BatchPreparedStatementSetter;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/** Manual document import, local-only. No network requests, command execution or raw-file persistence. */
@Service
public class DocumentMemoryService {
    static final int MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
    static final int MAX_PDF_PAGES = 60;
    private final JdbcTemplate jdbc;

    public DocumentMemoryService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public record DocumentInfo(UUID id, String fileName, String kind,
                               int byteSize, int chunkCount, Instant createdAt) { }

    @Transactional
    public DocumentInfo importDocument(MultipartFile file) {
        if (file == null || file.isEmpty() || file.getSize() > MAX_UPLOAD_BYTES)
            throw new IllegalArgumentException("MEMORY_DOC_FILE_SIZE");
        String name = safeFileName(file.getOriginalFilename());
        String kind = kind(name);
        byte[] bytes;
        try { bytes = file.getBytes(); }
        catch (IOException exception) { throw new IllegalArgumentException("MEMORY_DOC_READ_FAILED", exception); }
        if (bytes.length == 0 || bytes.length > MAX_UPLOAD_BYTES)
            throw new IllegalArgumentException("MEMORY_DOC_FILE_SIZE");

        String text = switch (kind) {
            case "pdf" -> extractPdf(bytes);
            default -> decodeUtf8(bytes);
        };
        List<String> chunks = DocumentTextChunks.split(text);
        String sha = sha256(bytes);
        UUID id = UUID.randomUUID();
        try {
            jdbc.update("INSERT INTO jarvis_documents(id,file_name,file_kind,sha256,byte_size,chunk_count) " +
                "VALUES(?,?,?,?,?,?)", id, name, kind, sha, bytes.length, chunks.size());
        } catch (DuplicateKeyException exception) {
            throw new IllegalArgumentException("MEMORY_DOC_ALREADY_IMPORTED", exception);
        }
        jdbc.batchUpdate("INSERT INTO jarvis_knowledge(id,title,source_url,excerpt,document_id) " +
            "VALUES(?,?,?,?,?)", new BatchPreparedStatementSetter() {
                @Override public int getBatchSize() { return chunks.size(); }
                @Override public void setValues(PreparedStatement statement, int index) throws java.sql.SQLException {
                    statement.setObject(1, UUID.randomUUID());
                    statement.setString(2, name + " (" + (index + 1) + "/" + chunks.size() + ")");
                    statement.setString(3, "jarvis://document/" + id + "/" + (index + 1));
                    statement.setString(4, chunks.get(index));
                    statement.setObject(5, id);
                }
            });
        return new DocumentInfo(id, name, kind, bytes.length, chunks.size(), Instant.now());
    }

    public List<DocumentInfo> list() {
        return jdbc.query("SELECT id,file_name,file_kind,byte_size,chunk_count,created_at " +
            "FROM jarvis_documents ORDER BY created_at DESC LIMIT 100", (rs, row) ->
            new DocumentInfo(rs.getObject("id", UUID.class), rs.getString("file_name"),
                rs.getString("file_kind"), rs.getInt("byte_size"),
                rs.getInt("chunk_count"), rs.getTimestamp("created_at").toInstant()));
    }

    @Transactional
    public boolean remove(UUID id) {
        if (id == null) throw new IllegalArgumentException("MEMORY_DOC_INVALID_ID");
        // ON DELETE CASCADE removes all associated jarvis_knowledge chunks atomically.
        return jdbc.update("DELETE FROM jarvis_documents WHERE id=?", id) > 0;
    }

    static String safeFileName(String name) {
        if (name == null || name.isBlank() || name.length() > 160 ||
            name.contains("/") || name.contains("\\") || name.indexOf('\u0000') >= 0 ||
            name.indexOf('<') >= 0 || name.indexOf('>') >= 0 ||
            name.chars().anyMatch(c -> c < 32))
            throw new IllegalArgumentException("MEMORY_DOC_INVALID_NAME");
        return name.strip();
    }

    static String kind(String name) {
        String value = name.toLowerCase(Locale.ROOT);
        if (value.endsWith(".pdf")) return "pdf";
        if (value.endsWith(".txt")) return "txt";
        if (value.endsWith(".md")) return "md";
        throw new IllegalArgumentException("MEMORY_DOC_UNSUPPORTED_FORMAT");
    }

    private static String decodeUtf8(byte[] bytes) {
        try {
            return StandardCharsets.UTF_8.newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT)
                .decode(ByteBuffer.wrap(bytes)).toString();
        } catch (CharacterCodingException exception) {
            throw new IllegalArgumentException("MEMORY_DOC_INVALID_UTF8", exception);
        }
    }

    private static String extractPdf(byte[] bytes) {
        // Reject obviously invalid input before invoking the PDF parser.
        if (bytes.length < 5 || bytes[0] != '%' || bytes[1] != 'P' ||
            bytes[2] != 'D' || bytes[3] != 'F' || bytes[4] != '-')
            throw new IllegalArgumentException("MEMORY_DOC_INVALID_PDF");
        try (PDDocument document = Loader.loadPDF(bytes)) {
            if (document.isEncrypted() || document.getNumberOfPages() > MAX_PDF_PAGES)
                throw new IllegalArgumentException("MEMORY_DOC_PDF_RESTRICTED");
            PDFTextStripper stripper = new PDFTextStripper();
            StringBuilder text = new StringBuilder();
            for (int page = 1; page <= document.getNumberOfPages(); page++) {
                stripper.setStartPage(page);
                stripper.setEndPage(page);
                text.append(stripper.getText(document)).append("\n\n");
                if (text.length() > DocumentTextChunks.MAX_TEXT_CHARS)
                    throw new IllegalArgumentException("MEMORY_DOC_TEXT_TOO_LARGE");
            }
            return text.toString();
        } catch (IOException | RuntimeException exception) {
            if (exception instanceof IllegalArgumentException validation) throw validation;
            throw new IllegalArgumentException("MEMORY_DOC_INVALID_PDF", exception);
        }
    }

    private static String sha256(byte[] bytes) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)); }
        catch (NoSuchAlgorithmException exception) { throw new IllegalStateException(exception); }
    }
}
