package pl.bawar.jarvis.chat.api;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.text.Normalizer;
import java.util.Locale;
import java.util.Properties;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Transparent, deterministic fallback while Jarvis's experimental Transformer is not
 * a usable conversational language model. It is not an LLM, a web search agent,
 * or autonomous training. User-approved question/answer facts are stored locally.
 *
 * No commands, network requests, arbitrary file reads, or code execution.
 */
public final class ChatReplyEngine {
    private static final int MAX_FACTS = 200;
    private static final Pattern TEACH = Pattern.compile("(?is)^zapamiętaj\\s*:\\s*(.+?)\\s*=>\\s*(.+)$");
    private static final Pattern MATH_PREFIX = Pattern.compile("(?iu)^(?:oblicz|policz|ile\\s+to|ile\\s+wynosi)\\s*:?\\s*");
    private final Path knowledgeFile;

    public ChatReplyEngine(Path knowledgeFile) {
        if (knowledgeFile == null || !knowledgeFile.isAbsolute()) {
            throw new IllegalArgumentException("Knowledge path must be absolute");
        }
        this.knowledgeFile = knowledgeFile.normalize();
    }

    /** All stateful operations are serialized to prevent lost updates. */
    public synchronized String reply(String userMessage) {
        if (userMessage == null || userMessage.isBlank()) {
            throw new IllegalArgumentException("Message is required");
        }
        String input = userMessage.strip();
        Matcher teach = TEACH.matcher(input);
        if (teach.matches()) return teach(teach.group(1), teach.group(2));
        String recalled = recall(input);
        if (recalled != null) return recalled;
        String expression = MATH_PREFIX.matcher(input).replaceFirst("").replaceFirst("\\?+$", "").strip();
        if (expression.length() <= 100 && expression.matches("[0-9.,+*/()\\-\\s]+")
                && expression.matches(".*[+*/()\\-].*")) {
            try {
                double value = new ExpressionParser(expression.replace(',', '.')).parse();
                if (!Double.isFinite(value) || Math.abs(value) > 1e12) {
                    return "Wynik jest poza obsługiwanym zakresem obliczeń.";
                }
                String result = Math.abs(value - Math.rint(value)) < 1e-10
                        ? Long.toString(Math.round(value))
                        : java.math.BigDecimal.valueOf(value).stripTrailingZeros().toPlainString();
                return "Wynik: " + result;
            } catch (IllegalArgumentException ex) {
                return "Nie mogę obliczyć tego wyrażenia. Użyj liczb, nawiasów i operatorów +, -, *, /.";
            }
        }
        String normalized = normalize(input);
        if (normalized.matches("(?u)(czesc|cześć|hej|hejka|witaj|dzien dobry|dzień dobry|hello|hi)[! ]*")) {
            return "Cześć! Jestem J.A.R.V.I.S. W tym trybie działam lokalnie. Potrafię wykonywać proste obliczenia i korzystać z wiedzy, którą jawnie zatwierdzisz.";
        }
        if (normalized.contains("kim jeste") || normalized.contains("co potrafi")
                || normalized.equals("pomoc") || normalized.equals("help")) {
            return "Jestem J.A.R.V.I.S. w podstawowym trybie lokalnym. Możesz wpisać „oblicz (2+3)*4” "
                    + "lub „zapamiętaj: pytanie => odpowiedź”, a następnie zadać zapisane pytanie. "
                    + "Eksperymentalny Transformer pozostaje w AI Lab; nie jest jeszcze modelem konwersacyjnym na poziomie ChatGPT.";
        }
        return "Nie mam jeszcze wiarygodnej odpowiedzi na to pytanie. "
                + "Mój eksperymentalny model językowy jest nadal trenowany i nie jest używany do zwykłych rozmów. "
                + "Mogę obliczać wyrażenia oraz odczytywać fakty, które zatwierdzisz poleceniem „zapamiętaj: pytanie => odpowiedź”. "
                + "Nie przeszukuję jeszcze internetu automatycznie.";
    }

    private String teach(String question, String answer) {
        question = question.strip();
        answer = answer.strip();
        if (question.length() < 3 || question.length() > 180 || answer.isEmpty() || answer.length() > 1200) {
            return "Nie zapisano wiedzy. Pytanie musi mieć 3–180 znaków, a odpowiedź 1–1200 znaków.";
        }
        if (question.indexOf('\n') >= 0 || answer.indexOf('\0') >= 0) {
            return "Nie zapisano wiedzy: niepoprawne znaki.";
        }
        if (Pattern.compile("(?i)(?:api[_-]?key|password|hasło|sekret|private.key|bearer\\s|token\\s*[=:])")
                .matcher(question + " " + answer).find()) {
            return "Nie zapisano: wygląda to na dane poufne. Nie umieszczaj sekretów w bazie wiedzy.";
        }
        try {
            Properties facts = readFacts();
            String key = normalize(question);
            if (!facts.containsKey(key) && facts.size() >= MAX_FACTS) {
                return "Osiągnięto limit 200 zatwierdzonych odpowiedzi.";
            }
            facts.setProperty(key, answer);
            saveFacts(facts);
            return "Zapamiętałem zatwierdzoną odpowiedź lokalnie. Zadaj teraz pytanie: " + question;
        } catch (IOException ex) {
            return "Nie udało się zapisać zatwierdzonej wiedzy. Sprawdź uprawnienia katalogu Jarvisa.";
        }
    }

    private String recall(String question) {
        try {
            return readFacts().getProperty(normalize(question));
        } catch (IOException ex) {
            return null; // no fake recalled facts when local data are unavailable
        }
    }

    private Properties readFacts() throws IOException {
        Properties props = new Properties();
        if (!Files.exists(knowledgeFile, LinkOption.NOFOLLOW_LINKS)) return props;
        if (Files.isSymbolicLink(knowledgeFile) || !Files.isRegularFile(knowledgeFile, LinkOption.NOFOLLOW_LINKS)
                || Files.size(knowledgeFile) > 512 * 1024) throw new IOException("Invalid knowledge file");
        try (InputStream input = Files.newInputStream(knowledgeFile)) { props.load(input); }
        return props;
    }

    private void saveFacts(Properties props) throws IOException {
        Path parent = knowledgeFile.getParent();
        if (parent == null) throw new IOException("Invalid knowledge path");
        Files.createDirectories(parent);
        if (Files.isSymbolicLink(parent) || Files.isSymbolicLink(knowledgeFile)) throw new IOException("Symlink denied");
        Path temp = Files.createTempFile(parent, ".jarvis-knowledge-", ".tmp");
        try {
            try (OutputStream output = Files.newOutputStream(temp)) {
                props.store(output, "JARVIS approved local knowledge - do not place secrets here");
            }
            try {
                Files.move(temp, knowledgeFile, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
            } catch (AtomicMoveNotSupportedException ex) {
                Files.move(temp, knowledgeFile, StandardCopyOption.REPLACE_EXISTING);
            }
        } finally {
            Files.deleteIfExists(temp);
        }
    }

    private static String normalize(String input) {
        return Normalizer.normalize(input.strip().toLowerCase(Locale.ROOT), Normalizer.Form.NFC)
                .replaceAll("[?!。]+$", "").replaceAll("\\s+", " ").strip();
    }

    /** Small arithmetic parser; never evaluate expressions as code. */
    private static final class ExpressionParser {
        private final String input;
        private int pos;
        private int depth;
        ExpressionParser(String input) { this.input = input; }
        double parse() {
            double value = sum();
            skipWhitespace();
            if (pos != input.length()) throw new IllegalArgumentException("Trailing input");
            return value;
        }
        private double sum() {
            double value = product();
            while (true) {
                skipWhitespace();
                if (take('+')) value += product();
                else if (take('-')) value -= product();
                else return value;
            }
        }
        private double product() {
            double value = factor();
            while (true) {
                skipWhitespace();
                if (take('*')) value *= factor();
                else if (take('/')) {
                    double denominator = factor();
                    if (denominator == 0) throw new IllegalArgumentException("Division by zero");
                    value /= denominator;
                } else return value;
            }
        }
        private double factor() {
            skipWhitespace();
            if (take('+')) return factor();
            if (take('-')) return -factor();
            if (take('(')) {
                if (++depth > 16) throw new IllegalArgumentException("Too many nested brackets");
                double value = sum();
                if (!take(')')) throw new IllegalArgumentException("Unclosed bracket");
                depth--;
                return value;
            }
            skipWhitespace();
            int start = pos;
            while (pos < input.length() && (Character.isDigit(input.charAt(pos)) || input.charAt(pos) == '.')) pos++;
            if (start == pos) throw new IllegalArgumentException("Expected number");
            try { return Double.parseDouble(input.substring(start, pos)); }
            catch (NumberFormatException ex) { throw new IllegalArgumentException("Invalid number", ex); }
        }
        private boolean take(char ch) {
            skipWhitespace();
            if (pos < input.length() && input.charAt(pos) == ch) { pos++; return true; }
            return false;
        }
        private void skipWhitespace() {
            while (pos < input.length() && Character.isWhitespace(input.charAt(pos))) pos++;
        }
    }
}
