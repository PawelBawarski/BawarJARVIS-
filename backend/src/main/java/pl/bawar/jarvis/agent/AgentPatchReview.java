package pl.bawar.jarvis.agent;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Conservative static signals for a NON-EXECUTED code proposal.
 * These heuristics are NOT syntax validation, security scanning or an approval to apply code.
 */
public final class AgentPatchReview {
    private static final Pattern EXECUTION = Pattern.compile(
        "\\b(?:ProcessBuilder|Runtime\\.getRuntime\\s*\\(\\s*\\)\\s*\\.\\s*exec|execSync|child_process|subprocess\\.(?:run|Popen)|os\\.system)\\b");
    private static final Pattern DYNAMIC = Pattern.compile("\\b(?:eval\\s*\\(|new\\s+Function\\s*\\()", Pattern.CASE_INSENSITIVE);
    private static final Pattern SENSITIVE = Pattern.compile(
        "(?i)\\b(?:password|secret|api[_-]?key|token)\\s*[:=]\\s*['\"][^'\"\\r\\n]{4,}['\"]");

    private AgentPatchReview() { }

    static Summary examine(String original, String replacement) {
        String[] before = original.split("\\n", -1);
        String[] after = replacement.split("\\n", -1);
        int prefix = 0;
        while (prefix < before.length && prefix < after.length && before[prefix].equals(after[prefix])) prefix++;
        int suffix = 0;
        while (suffix < before.length - prefix && suffix < after.length - prefix &&
            before[before.length - 1 - suffix].equals(after[after.length - 1 - suffix])) suffix++;

        int removed = before.length - prefix - suffix;
        int added = after.length - prefix - suffix;
        List<String> warnings = new ArrayList<>();
        if (added + removed > 40 || replacement.length() > original.length() * 2L) {
            warnings.add("LARGE_CHANGE");
        }
        if (appeared(EXECUTION, original, replacement)) warnings.add("PROCESS_EXECUTION");
        if (appeared(DYNAMIC, original, replacement)) warnings.add("DYNAMIC_CODE");
        if (appeared(SENSITIVE, original, replacement)) warnings.add("POSSIBLE_SECRET");
        return new Summary(before.length, after.length, removed, added, List.copyOf(warnings));
    }

    private static boolean appeared(Pattern pattern, String original, String proposed) {
        return pattern.matcher(proposed).find() && !pattern.matcher(original).find();
    }

    /** Counts cover the changed middle region, not an AST/semantic diff. */
    public record Summary(int beforeLines, int afterLines, int removedLines, int addedLines,
                   List<String> warnings) { }
}
