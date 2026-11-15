package pl.bawar.jarvis.chat.api;

import java.util.Locale;
import java.util.regex.Pattern;

/** Conservative opt-in fallback: user explicitly requests web or Qwen admits lack of knowledge. */
final class WebFallbackPolicy {
    private static final Pattern UNCERTAIN = Pattern.compile(
        "(?iu)(?:nie\\s+(?:wiem|mam\\s+(?:aktualnych|wystarczaj[ąa]cych|wiarygodnych)\\s+informacji)"
        + "|nie\\s+mog[ęe]\\s+(?:tego\\s+)?(?:potwierdzi[ćc]|sprawdzi[ćc])"
        + "|nie\\s+jestem\\s+pew(?:ien|na)|I\\s+(?:don't\\s+know|cannot\\s+verify)"
        + "|my\\s+knowledge\\s+(?:is|may\\s+be)\\s+outdated)");
    private static final Pattern EXPLICIT = Pattern.compile(
        "(?iu)(?:szukaj|sprawd[źz]|wyszukaj|znajd[źz])\\s+(?:to\\s+)?(?:w\\s+internecie|online|w\\s+sieci)"
        + "|(?:search|look\\s+up)\\s+(?:the\\s+)?web");
    private static final Pattern SENSITIVE = Pattern.compile(
        "(?iu)(?:password|has[łl]o|api[_-]?key|secret|sekret|bearer|access[_-]?token|private\\s+key)\\s*[:=]\\s*\\S+");
    private WebFallbackPolicy() { }
    static boolean isSensitive(String question) {
        return question == null || SENSITIVE.matcher(question).find();
    }

    static boolean shouldSearch(String question, String answer) {
        if (question == null || question.isBlank() || question.length() > 450
                || SENSITIVE.matcher(question).find()) return false;
        return EXPLICIT.matcher(question).find() ||
                (answer != null && UNCERTAIN.matcher(answer).find());
    }
}
